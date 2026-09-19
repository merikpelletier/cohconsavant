import { Buffer } from 'node:buffer';
import { insertRows, readRows, updateRow } from './supabase.js';
import { pollPrediction as _pollPrediction, startModelPrediction, startVersionPrediction } from './replicate.js';
import { storeExternalMedia } from './media.js';
import { currentAIQuote } from './aiQuoteContext.js';

// ── Aspect Ratio Enforcement ──────────────────────────────────────────────────
// Single source of truth for pixel dimensions per ratio.
// seedream-4.5: when size='custom', width/height are honored directly and
// aspect_ratio is ignored — so we ALWAYS send explicit width/height to force
// exact output dimensions regardless of any reference image_input.
const RATIO_DIMENSIONS = {
  '4:3':  { width: 2560, height: 1920 },
  '3:4':  { width: 1920, height: 2560 },
  '16:9': { width: 2560, height: 1440 },
  '9:16': { width: 1440, height: 2560 },
  '1:1':  { width: 2048, height: 2048 },
  '3:2':  { width: 2400, height: 1600 },
  '2:3':  { width: 1600, height: 2400 },
};

// Default fallback when caller omits aspect_ratio — neutral 4:3, never 9:16.
const DEFAULT_IMAGE_RATIO = '4:3';
const DEFAULT_VIDEO_RATIO = '16:9';

// Returns { width, height } for a given ratio string, falling back to 4:3.
function resolveDims(ratio) {
  const dims = RATIO_DIMENSIONS[ratio] || RATIO_DIMENSIONS[DEFAULT_IMAGE_RATIO];
  return { dims, resolvedRatio: RATIO_DIMENSIONS[ratio] ? ratio : DEFAULT_IMAGE_RATIO };
}

// Build the shared Nano Banana image-generation/editing input.
function buildNanoBananaInput(prompt, imageInput, ratio) {
  const { resolvedRatio } = resolveDims(ratio);
  return {
    prompt,
    image_input: (imageInput || []).filter(Boolean),
    aspect_ratio: resolvedRatio,
    output_format: 'jpg',
  };
}

function extractUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return extractUrl(output[0]);
  if (typeof output === 'object') {
    if (typeof output.url === 'function') return output.url();
    if (typeof output.url === 'string') return output.url;
    if (typeof output.image === 'string') return output.image;
    const strVal = Object.values(output).find(v => typeof v === 'string' && v.startsWith('http'));
    if (strVal) return strVal;
  }
  return null;
}

async function replicateGenerateResponse(payload, user) {
  try {
    const TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

    // Convert any URL to a base64 data URI so Replicate can access it regardless of auth
    const toDataUri = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch: ${url} (${r.status})`);
      const blob = await r.blob();
      const type = blob.type || 'image/jpeg';
      const buf = new Uint8Array(await blob.arrayBuffer());
      let b64 = '';
      const chunk = 8192;
      for (let i = 0; i < buf.length; i += chunk) {
        b64 += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      return `data:${type};base64,${btoa(b64)}`;
    };

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { method, photo_url, photo_urls, reference_video_url, reference_image_url, prompt_override, prompt, reference_image_urls, audio_url, aspect_ratio, costume_url, enable_pbr } = payload;

    if (!method) return Response.json({ error: 'method is required' }, { status: 400 });

    // Get tool pricing
    const toolPricing = (await readRows('tool_pricings', { filters: { tool_id: method, is_active: true }, limit: 1 }))[0];
    const quote = currentAIQuote();
    const tokenCost = quote?.token_price ?? toolPricing?.token_cost ?? 0;

    // Admins skip token checks so they can test freely
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const isAdmin = user.app_metadata?.role === 'admin' || user.email?.toLowerCase().trim() === adminEmail;
    if (!isAdmin && !quote && (!toolPricing || Number(tokenCost) <= 0)) {
      const error = new Error('Ce service IA est temporairement indisponible : son prix en tokens doit être configuré.');
      error.status = 503;
      throw error;
    }
    const trackingContext = { user_email: user.email, user_id: user.id, tool_id: method, tokens_charged: isAdmin ? 0 : Number(tokenCost) };
    const pollPrediction = (predictionId) => _pollPrediction(predictionId, 240000, trackingContext);
    const startPrediction = (version, input) => startVersionPrediction(version, input, trackingContext);
    const startModel = (model, input) => startModelPrediction(model, input, trackingContext);

    // Check user's token balance
    let balance = (await readRows('user_token_balances', { filters: { user_email: user.email }, limit: 1 }))[0];

    if (!balance) {
      [balance] = await insertRows('user_token_balances', {
        user_email: user.email,
        balance: 0,
        last_updated: new Date().toISOString(),
        created_by_id: user.id,
      });
    }

    // Check if user has enough tokens (admins bypass)
    if (!isAdmin && !quote && balance.balance < tokenCost) {
      return Response.json({
        error: 'Insufficient tokens',
        required: tokenCost,
        balance: balance.balance,
        message: `This tool requires ${tokenCost} tokens. Your balance: ${balance.balance} tokens.`
      }, { status: 402 });
    }

    let rawOutput;
    let preUploadedFileUrl = null;
    let composeResolvedRatio = null;
    let composeSentDims = null;

    if (method === 'body_and_voice') {
      if (!photo_url || !reference_video_url) {
        return Response.json({ error: 'photo_url and reference_video_url required' }, { status: 400 });
      }
      const prediction = await startModel('kwaivgi/kling-v3-omni-video', {
        image: photo_url,
        video: reference_video_url,
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'faceswitch') {
      if (!photo_url || !reference_video_url) {
        return Response.json({ error: 'photo_url and reference_video_url required' }, { status: 400 });
      }
      const swapImg = await toDataUri(photo_url);
      const prediction = await startPrediction('278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34', {
        swap_image: swapImg,
        input_image: reference_video_url,
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'character_photo') {
      if (!photo_url || !reference_image_url) {
        return Response.json({ error: 'photo_url and reference_image_url required' }, { status: 400 });
      }
      const ratio = aspect_ratio || DEFAULT_IMAGE_RATIO;
      const p = prompt_override || `Image A is the facial identity reference. Image B is the target image. Replace the face in Image B with the face from Image A while keeping Image B's pose, camera angle, framing, glasses, hairstyle, clothing, lighting, background, and photorealistic style. The final result must look like the person from Image A was photographed naturally in the same position and setting as Image B. Preserve realistic skin texture, beard details, facial proportions, shadows, and lens reflections. Do not change the background, outfit, glasses, crop, or overall composition. Output in ${ratio} format.`;
      const input = buildNanoBananaInput(p, [photo_url, reference_image_url], ratio);
      const prediction = await startModel('google/nano-banana-2', input);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'reference_sheet_swap') {
      if (!photo_url || !reference_image_url) {
        return Response.json({ error: 'photo_url and reference_image_url required' }, { status: 400 });
      }
      const ratio = aspect_ratio || DEFAULT_IMAGE_RATIO;
      const p = prompt_override || `Image A is the actor's full-body reference photo. Image B is the character reference sheet image. Replace the entire person in Image B — face, head, neck, body shape, skin tone, and physique — with the person from Image A. Keep exactly: the pose/stance, the full outfit (every garment, fabric, colour, accessory), background, lighting, camera angle, framing, and photorealistic style from Image B. The result must look like the person from Image A is wearing the exact costume from Image B and standing in the exact same pose and scene. Do not change any clothing, props, or background elements. Output in ${ratio} format.`;
      const input = buildNanoBananaInput(p, [photo_url, reference_image_url], ratio);
      const prediction = await startModel('google/nano-banana-2', input);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'character_sheet') {
      // 3-view turnaround reference sheet: generate front, side and back full-body
      // views with FLUX.1 Kontext Pro (a transformation model that can rotate the
      // subject while preserving identity), then composite them side by side.
      const allPhotos = photo_urls || (photo_url ? [photo_url] : []);
      if (!allPhotos || allPhotos.length === 0) {
        return Response.json({ error: 'photo_urls required' }, { status: 400 });
      }
      const primaryPhoto = allPhotos[0];
      if (costume_url) {
        // Single-call concept: Seedream accepts both images and renders the full
        // 3-view turnaround sheet in ONE generation — no separate dress step, no
        // 3x FLUX rotation. One prediction total.
        const userExtra = prompt_override ? ` Additional styling requested by the user — apply to every view: ${prompt_override}.` : '';
        const sheetPrompt = `Image A is the actor. Image B is the costume the actor must wear. Render a professional character turnaround reference sheet: ONE wide image showing THREE full-body views of the SAME person arranged side by side — LEFT is the straight FRONT view, CENTER is the SIDE profile view, RIGHT is the straight BACK view. The person is the actor from Image A (keep their exact face, body shape, skin tone, and hair) wearing the EXACT costume/outfit from Image B (keep every garment, color, fabric, pattern, accessory, and fit as shown in Image B).${userExtra} All three views must show the identical person in the identical costume, including any shoes, earrings, jewelry, hats, or accessories mentioned. Each view: full body head to toe, neutral A-pose with arms slightly away from the body, standing on a clean seamless white studio background with a soft floor shadow. Even studio lighting, photorealistic, natural skin texture. Three figures only, arranged horizontally in one single wide image. No text, no labels, no captions, no extra figures.`;
        const input = buildNanoBananaInput(sheetPrompt, [primaryPhoto, costume_url], aspect_ratio || '16:9');
        const prediction = await startModel('google/nano-banana-2', input);
        const out = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);
        const sheetUrl = extractUrl(out);
        if (!sheetUrl) throw new Error('Character sheet produced no URL');
        preUploadedFileUrl = await storeExternalMedia(sheetUrl, 'character-sheet');
      } else {
        // No costume: single Seedream call — 3-view turnaround from the actor photo only
        const sheetPrompt = `Image A is the actor. Render a professional character turnaround reference sheet: ONE wide image showing THREE full-body views of the SAME person arranged side by side — LEFT is the straight FRONT view, CENTER is the SIDE profile view, RIGHT is the straight BACK view. The person is the actor from Image A (keep their exact face, body shape, skin tone, hair, and outfit). Each view: full body head to toe, neutral A-pose with arms slightly away from the body, standing on a clean seamless white studio background with a soft floor shadow. Even studio lighting, photorealistic, natural skin texture. Three figures only, arranged horizontally in one single wide image. No text, no labels, no captions, no extra figures.`;
        const input = buildNanoBananaInput(sheetPrompt, [primaryPhoto], aspect_ratio || '16:9');
        const prediction = await startModel('google/nano-banana-2', input);
        const out = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);
        const sheetUrl = extractUrl(out);
        if (!sheetUrl) throw new Error('Character sheet produced no URL');
        preUploadedFileUrl = await storeExternalMedia(sheetUrl, 'character-sheet');
      }

    } else if (method === 'animate_image') {
      // Animate a still image into a video using Kling v2.6 image-to-video
      if (!photo_url) {
        return Response.json({ error: 'photo_url required' }, { status: 400 });
      }
      const klingInput = {
        start_image: photo_url,
        prompt: prompt_override || prompt || 'Cinematic subtle natural motion, professional film quality.',
        duration: 5,
        aspect_ratio: aspect_ratio || DEFAULT_VIDEO_RATIO,
      };
      if (audio_url) klingInput.audio_url = audio_url;
      const prediction = await startModel('kwaivgi/kling-v2.6', klingInput);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'animate_with_reference') {
      // Animate image using a reference video for motion (Kling motion control)
      if (!photo_url || !reference_video_url) {
        return Response.json({ error: 'photo_url and reference_video_url required' }, { status: 400 });
      }
      const klingInput = { image: photo_url, video: reference_video_url };
      const prediction = await startModel('kwaivgi/kling-v2.6-motion-control', klingInput);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'lip_sync') {
      // Add lip sync to a video using audio
      if (!photo_url || !audio_url) {
        return Response.json({ error: 'photo_url and audio_url required' }, { status: 400 });
      }
      const klingInput = {
        video: photo_url,
        audio: audio_url,
      };
      const prediction = await startModel('kwaivgi/kling-lip-sync', klingInput);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'headshot') {
      // Identity-preserving actor headshot via Google Nano Banana 2
      // (Gemini 3.1 Flash Image). The uploaded portrait is passed as the
      // image_input reference so the model keeps the same person, while the
      // text prompt restyles lighting/background/wardrobe and sets the
      // expression. Nano Banana 2 is conversational/edit-based, so it holds
      // facial identity far better than a text-to-image restyle.
      if (!photo_url) {
        return Response.json({ error: 'photo_url required' }, { status: 400 });
      }
      if (!prompt) {
        return Response.json({ error: 'prompt required' }, { status: 400 });
      }
      const ratio = aspect_ratio || '3:4';
      const prediction = await startModel('google/nano-banana-2', {
        prompt,
        image_input: [photo_url],
        aspect_ratio: ratio,
        output_format: 'jpg',
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'compose_scene') {
      const imgs = reference_image_urls || [];
      if (!prompt && imgs.length === 0) {
        return Response.json({ error: 'prompt or reference_image_urls required' }, { status: 400 });
      }
      const ratio = aspect_ratio || DEFAULT_IMAGE_RATIO;
      const input = buildNanoBananaInput(prompt, imgs.slice(0, 14), ratio);
      composeResolvedRatio = input.aspect_ratio;
      const prediction = await startModel('google/nano-banana-2', input);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'text_to_video') {
      if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });
      const prediction = await startModel('kwaivgi/kling-v2.6', {
        prompt,
        duration: 5,
        aspect_ratio: aspect_ratio || DEFAULT_VIDEO_RATIO,
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'generate_3d') {
      // TRELLIS (Microsoft) via firtoz/trellis — image-to-3D only, significantly
      // higher quality than Hunyuan 3D. For text-to-3D, first generate a clean
      // reference image with Seedream 4.5, then feed it to TRELLIS.
      let imageUrl = photo_url;
      if (!imageUrl && prompt) {
        const imgInput = buildNanoBananaInput(
          `${prompt}. Clean single object centered on a simple plain white background, suitable for 3D reconstruction, photorealistic, well-lit, no text, no people.`,
          null,
          '1:1'
        );
        const imgPrediction = await startModel('google/nano-banana-2', imgInput);
        const imgOutput = imgPrediction.status === 'succeeded' ? imgPrediction.output : await pollPrediction(imgPrediction.id);
        imageUrl = extractUrl(imgOutput);
        if (!imageUrl) throw new Error('Failed to generate reference image for 3D');
      }
      if (!imageUrl) {
        return Response.json({ error: 'prompt or photo_url required for generate_3d' }, { status: 400 });
      }
      const trellisInput = {
        images: [await toDataUri(imageUrl)],
        texture_size: 2048,
        mesh_simplify: 0.9,
        generate_color: true,
        generate_model: true,
        randomize_seed: true,
        generate_normal: !!enable_pbr,
        save_gaussian_ply: false,
        ss_sampling_steps: 38,
        slat_sampling_steps: 12,
        return_no_background: false,
        ss_guidance_strength: 7.5,
        slat_guidance_strength: 3,
      };
      const prediction = await startModel('firtoz/trellis', trellisInput);
      const trellisOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);
      // TRELLIS returns an object; extract the GLB model URL explicitly
      let modelUrl = null;
      if (trellisOutput && typeof trellisOutput === 'object' && !Array.isArray(trellisOutput)) {
        modelUrl = trellisOutput.model || trellisOutput.glb || trellisOutput.output;
      }
      if (!modelUrl) modelUrl = extractUrl(trellisOutput);
      if (!modelUrl) throw new Error(`TRELLIS produced no model URL: ${JSON.stringify(trellisOutput)}`);
      rawOutput = modelUrl;

    } else {
      return Response.json({ error: 'Unknown method' }, { status: 400 });
    }

    let file_url;
    if (preUploadedFileUrl) {
      file_url = preUploadedFileUrl;
    } else {
      let outputUrl = extractUrl(rawOutput);
      if (!outputUrl) throw new Error(`No URL in output: ${JSON.stringify(rawOutput)}`);

      // For faceswitch, run GFPGAN face restoration to improve quality
      if (method === 'faceswitch') {
        try {
          const restorePrediction = await startPrediction(
            '0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c',
            { img: outputUrl, scale: 2, version: 'v1.4' }
          );
          const restoredOutput = restorePrediction.status === 'succeeded'
            ? restorePrediction.output
            : await pollPrediction(restorePrediction.id);
          const restoredUrl = extractUrl(restoredOutput);
          if (restoredUrl) outputUrl = restoredUrl;
        } catch (e) {
          console.error('GFPGAN restoration failed, using raw output:', e.message);
        }
      }

      file_url = await storeExternalMedia(outputUrl, `replicate-${method}`);
    }

    // Deduct tokens (admins skip deduction)
    let newBalance = balance.balance;
    if (!isAdmin && !quote) {
      newBalance = balance.balance - tokenCost;
      await updateRow('user_token_balances', balance.id, {
        balance: newBalance,
        last_updated: new Date().toISOString()
      });
      await insertRows('token_transactions', {
        user_email: user.email,
        transaction_type: 'usage',
        token_amount: -tokenCost,
        balance_after: newBalance,
        related_entity: `replicate_${method}`,
        created_at: new Date().toISOString(),
        created_by_id: user.id,
      });
    }

    return Response.json({ file_url, token_cost: tokenCost, balance_after: newBalance, resolved_ratio: composeResolvedRatio, sent_dims: composeSentDims });
  } catch (error) {
    console.error('replicateGenerate error:', error.message);
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function replicateGenerate(payload, user) {
  const response = await replicateGenerateResponse(payload, user);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Échec Replicate');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}
