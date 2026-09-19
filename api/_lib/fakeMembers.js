import { insertRows, readRows } from './supabase.js';
import { predictionOutput, startModelPrediction } from './replicate.js';
import { storeExternalMedia } from './media.js';

const LLM_MODEL = 'meta/meta-llama-3-70b-instruct';
const IMAGE_MODEL = 'bytedance/seedream-4.5';
const IMAGE_PROBABILITY = 0.33;

function profileContext(member) {
  const parts = [];
  if (member.display_name) parts.push(`Nom: ${member.display_name}`);
  if (member.title) parts.push(`Titre/Rôle: ${member.title}`);
  if (member.bio) parts.push(`Bio: ${member.bio}`);
  if (member.age_range) parts.push(`Tranche d'âge: ${member.age_range}`);
  if (member.sexual_role) parts.push(`Rôle sexuel: ${member.sexual_role}`);
  if (member.body_type) parts.push(`Type de corps: ${member.body_type}`);
  if (member.ai_instructions) parts.push(`Instructions de personnalité IA: ${member.ai_instructions}`);
  return parts.join('\n');
}

function jsonOutput(output) {
  const text = Array.isArray(output) ? output.join('') : String(output || '');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  return JSON.parse(fenced.slice(fenced.indexOf('{'), fenced.lastIndexOf('}') + 1));
}

function outputUrl(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return outputUrl(output[0]);
  if (output && typeof output === 'object') return output.url || output.image || Object.values(output).find((value) => typeof value === 'string' && value.startsWith('http'));
  return null;
}

export async function generateFakeMemberPosts(user) {
  const tracking = { user_email: user?.email || null, user_id: user?.id || null, tool_id: 'fake_member_posts' };
  const fakeMembers = await readRows('member_profiles', { filters: { is_fake: true }, limit: 500 });
  const now = new Date();
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endOfDay = startOfDay + 86400000;
  const results = [];

  for (const member of fakeMembers) {
    try {
      const recentPosts = await readRows('member_posts', { filters: { member_email: member.user_email }, sort: '-created_date', limit: 50 });
      if (recentPosts.some((post) => new Date(post.created_date).getTime() >= startOfDay && new Date(post.created_date).getTime() < endOfDay)) {
        results.push({ member: member.display_name, status: 'skipped' });
        continue;
      }
      const wantImage = Math.random() < IMAGE_PROBABILITY;
      const prompt = `Tu es "${member.display_name}", un membre fictif d'une communauté créative et artistique appelée "Le Cochon Savant". Tu publies un post sur le fil de la communauté, à la manière d'un post Facebook.

Voici ton profil:
${profileContext(member)}

Génère un post ORIGINAL, authentique et naturel qui correspond à ta personnalité. Le post peut parler de:
- Tes pensées, réflexions, humeur du jour
- Un projet créatif, une idée, une inspiration
- Une recommandation, une question à la communauté
- Un moment de vie, une anecdote

Le ton doit être cohérent avec ton profil et tes instructions de personnalité. Évite les clichés et le contenu générique. Sois spontané, comme un vrai membre qui partage quelque chose.

Réponds uniquement en JSON valide avec title (80 caractères maximum), description (1 à 4 phrases)${wantImage ? ' et image_prompt (description détaillée en anglais pour une image photoréaliste)' : ''}.`;
      const llm = await startModelPrediction(LLM_MODEL, { prompt, max_tokens: 1000, temperature: 0.85 }, tracking);
      const generated = jsonOutput(await predictionOutput(llm));
      const post = {
        member_email: member.user_email,
        member_name: member.display_name,
        title: generated.title || 'Partage',
        description: generated.description || '',
        links: [], images: [],
      };
      if (wantImage && generated.image_prompt) {
        try {
          const image = await startModelPrediction(IMAGE_MODEL, { prompt: generated.image_prompt, size: 'custom', width: 1024, height: 1024, aspect_ratio: '1:1' }, tracking);
          const url = outputUrl(await predictionOutput(image));
          if (url) post.images = [await storeExternalMedia(url, 'fake-member-post')];
        } catch (error) {
          console.error('Fake member image generation failed:', error.message);
        }
      }
      await insertRows('member_posts', post);
      results.push({ member: member.display_name, status: 'created', hasImage: post.images.length > 0 });
    } catch (error) {
      results.push({ member: member.display_name, status: 'error', error: error.message });
    }
  }
  return { success: true, total: fakeMembers.length, results };
}
