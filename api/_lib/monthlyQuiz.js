import { insertRows, readRows, updateRow } from './supabase.js';
import { predictionOutput, startModelPrediction } from './replicate.js';
import { storeExternalMedia } from './media.js';

const LLM_MODEL = 'meta/meta-llama-3-70b-instruct';
const IMAGE_MODEL = 'bytedance/seedream-4.5';

function extractText(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(extractText).join('');
  if (typeof output === 'object') return Object.values(output).map(extractText).join('');
  return String(output);
}

function extractUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return extractUrl(output[0]);
  if (typeof output === 'object') {
    if (typeof output.url === 'string') return output.url;
    if (typeof output.image === 'string') return output.image;
    return Object.values(output).find((value) => typeof value === 'string' && value.startsWith('http')) || null;
  }
  return null;
}

function parseJsonFromText(text) {
  let value = text.trim();
  const fence = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) value = fence[1].trim();
  const first = value.indexOf('{');
  const last = value.lastIndexOf('}');
  if (first >= 0 && last > first) value = value.slice(first, last + 1);
  return JSON.parse(value);
}

async function nextTopic() {
  let topics = await readRows('monthly_quiz_topics', { sort: 'created_date', limit: 500 });
  if (!topics.length) {
    const error = new Error('Aucun sujet configuré dans la liste admin.');
    error.status = 400;
    throw error;
  }
  let topic = topics.find((item) => !item.used);
  if (!topic) {
    await Promise.all(topics.map((item) => updateRow('monthly_quiz_topics', item.id, { used: false, used_at: null })));
    topics = await readRows('monthly_quiz_topics', { sort: 'created_date', limit: 500 });
    topic = topics[0];
  }
  return topic;
}

export async function generateMonthlyQuiz(user) {
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'monthly_quiz' };
  const topic = await nextTopic();
  const quizType = topic.quiz_type || 'trivia';
  const topicLabel = topic.label;
  const systemPrompt = 'Tu es un créateur de quiz expert en culture gay, LGBTQ+ et queer. Tu réponds UNIQUEMENT avec du JSON valide, sans texte avant ni après, sans markdown. Tout le contenu est en français, ton ludique et célébrant la culture gay, adulte mais respectueux.';
  const prompt = quizType === 'trivia'
    ? `Crée un quiz de trivia sur le sujet suivant : "${topicLabel}", ancré dans la culture gay. Génère EXACTEMENT 10 questions. Réponds avec ce JSON exact : {"name":"Nom court","description":"Une phrase","questions":[{"question":"Question","correct_answers":["bonne réponse"],"wrong_answers":["mauvaise 1","mauvaise 2","mauvaise 3"],"time_limit":30}]}`
    : `Crée un quiz de personnalité "Ceci ou cela" sur le sujet suivant : "${topicLabel}", ancré dans la culture gay. Génère EXACTEMENT 10 questions binaires et 3 résultats. Réponds avec ce JSON exact : {"name":"Nom court","description":"Une phrase","traits":["trait1","trait2","trait3"],"questions":[{"question":"Ceci ou cela ?","option_a_text":"option A","option_a_traits":{"trait1":2},"option_b_text":"option B","option_b_traits":{"trait2":2}}],"results":[{"trait_key":"trait1","title":"Le ...","description":"Interprétation"}]}`;

  const llmPrediction = await startModelPrediction(LLM_MODEL, { prompt, system_prompt: systemPrompt, max_tokens: 4096, temperature: 0.85 }, tracking);
  const quiz = parseJsonFromText(extractText(await predictionOutput(llmPrediction)));
  if (!Array.isArray(quiz.questions) || !quiz.questions.length) throw new Error('Replicate n’a retourné aucune question valide');

  const imagePrediction = await startModelPrediction(IMAGE_MODEL, {
    prompt: `Image de couverture vibrante et moderne pour un quiz sur le thème: "${topicLabel}" dans la culture gay. Esthétique pop, couleurs vives, composition éditoriale élégante, pas de texte, pas de visage reconnaissable.`,
    image_input: [], size: 'custom', width: 2560, height: 1440, aspect_ratio: '16:9',
  }, tracking);
  const imageUrl = extractUrl(await predictionOutput(imagePrediction));
  if (!imageUrl) throw new Error('Replicate n’a retourné aucune image de couverture');
  const coverUrl = await storeExternalMedia(imageUrl, 'quiz-cover');

  const [theme] = await insertRows('quiz_themes', {
    name: quiz.name || topicLabel, quiz_type: quizType, cover_image: coverUrl,
    description: quiz.description || '', order: 0, is_active: true, created_by_id: user.id,
  });
  if (!theme?.id) throw new Error('Échec de sauvegarde du thème');

  if (quizType === 'trivia') {
    await insertRows('quiz_questions', quiz.questions.map((question) => ({
      theme_id: theme.id, question: question.question,
      correct_answers: question.correct_answers || [], wrong_answers: question.wrong_answers || [],
      time_limit: question.time_limit || 30, is_active: true, created_by_id: user.id,
    })));
  } else {
    await insertRows('personality_questions', quiz.questions.map((question, order) => ({
      theme_id: theme.id, question: question.question, option_a_text: question.option_a_text,
      option_a_traits: question.option_a_traits || {}, option_b_text: question.option_b_text,
      option_b_traits: question.option_b_traits || {}, is_active: true, order, created_by_id: user.id,
    })));
    if (quiz.results?.length) {
      await insertRows('personality_results', quiz.results.map((result, order) => ({
        theme_id: theme.id, trait_key: result.trait_key, title: result.title,
        description: result.description || '', order, created_by_id: user.id,
      })));
    }
  }
  await updateRow('monthly_quiz_topics', topic.id, { used: true, used_at: new Date().toISOString() });
  return { success: true, theme_id: theme.id, theme_name: theme.name, quiz_type: quizType, topic_label: topicLabel, questions: quiz.questions.length, cover_image: coverUrl };
}
