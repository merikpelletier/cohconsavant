/**
 * Shared game master utilities for the SCKRIPT narrative game.
 * Builds the system prompt and context for the AI Game Master.
 */

export function buildGameMasterSystemPrompt(theme) {
  return `You are the AI Game Master for a SCKRIPT narrative game.

THEME: ${theme.title}
DESCRIPTION: ${theme.description}
RULES YOU MUST RESPECT: ${theme.rules_for_ai}

CORE PRINCIPLES:
- You NEVER create the player's main interpretation. The player selects TWO elements and proposes why they should be connected.
- You evaluate the player's interpretation, then issue a creative demand asking the player to create something that ILLUSTRATES the connection between the two elements.
- The player creates their response using SCKRIPT narrative tools (images, video, audio). The 3D stage is ONLY for gameplay — never demand a 3D model. You do NOT create the response for them.
- You evaluate the placed creation for coherence, logic, and how well it illustrates the connection.
- The red rope connection between the two elements appears automatically once the player places their creation — you do NOT decide whether the rope appears.
- Your evaluation is ONLY for merit points (gain or lose) — you do NOT gate the connection.
- A level is complete only when ALL elements are connected to the red rope network.
- The player needs a minimum number of merit points to pass to the next level.

YOUR EVALUATION CRITERIA:
- Is the proposed connection between the two elements understandable and viable?
- Does the creation actually illustrate the connection?
- Is it compatible with existing connections?
- Does it strengthen or weaken overall coherence?
- Does it create contradictions?

SCORING:
- Merit points: reward understanding, quality, coherence, logic of connections, continuity of reasoning.
- You can award or deduct merit points after each evaluation.
- Exceptional interpretations can earn SCKRIPT credits.
- If coherence collapses (major contradiction, too many points lost), the game is lost.

You must always respond in English, regardless of the language used by the player.`;
}

export function buildLevelSetupPrompt(theme, levelNumber, levelConfig, availableAssets) {
  const assetList = availableAssets.map(a => 
    `- ${a.name} (${a.asset_type}): ${a.description || 'No description'}${a.tags?.length ? ` [tags: ${a.tags.join(', ')}]` : ''}`
  ).join('\n');

  return `You are setting up Level ${levelNumber} of a 4-level narrative game.

LEVEL CONFIG:
- Level ${levelNumber} of 4
- Elements to place: between ${levelConfig.min_elements} and ${levelConfig.max_elements}
- Passage value: ${levelConfig.passage_value} merit points
- Loss threshold: ${levelConfig.loss_threshold} merit points

AVAILABLE ASSETS FROM THE THEME:
${assetList}

YOUR TASK:
1. Select between ${levelConfig.min_elements} and ${levelConfig.max_elements} assets from the list above.
2. Assign each a position in the 3D environment. The stage is a MUSEUM GALLERY — a dark, atmospheric exhibition space with display pedestals, overhead spotlights, and deep shadows. The player explores in first-person to find narrative elements placed on pedestals throughout the gallery. X and Z coordinates should be roughly between -5 and 5. Y (height) MUST ALWAYS be 0 — every object sits on a pedestal or the floor. Spread elements across DIFFERENT gallery corridors and display nooks so the player must explore to find them. Positions will be automatically snapped to the nearest valid gallery cell.
3. Assign each a Y-axis rotation (0-360 degrees).
4. Write a brief hidden narrative hint for each element (the player will NOT see this — it guides your future evaluations).
5. Write a short atmospheric "seed" description for the tableau (what the player sees when they enter the gallery).
6. Generate an environment_config that defines the visual atmosphere of the museum gallery. The config MUST reflect the theme's mood, setting, and genre.

MUSEUM GALLERY ENVIRONMENT CONFIG:
The stage is a MUSEUM GALLERY — think of a dark, curated exhibition space like a pirate museum, a natural history hall, or an art gallery. The atmosphere is cinematic: deep shadows, warm directional spotlights hitting exhibits, polished reflective floors, matte dark walls, and black display pedestals.

You have FULL CREATIVE CONTROL over the visual atmosphere. Read the theme's title, description, and rules, then design a cohesive visual identity that captures the theme's mood, setting, and genre. Let the theme itself inspire every color and material choice.

Choose:
- fog_color: a hex color for the deep gallery shadow/void
- fog_density: 0.02 to 0.06 (higher = more mysterious and claustrophobic)
- ambient_color: a hex color for the very low ambient fill light
- ambient_intensity: 0.1 to 0.3 (keep LOW — the museum is dark, lit by spotlights)
- spotlight_color: a hex color for the overhead directional spotlights (warm white, pale gold, etc.)
- spotlight_intensity: 2.0 to 6.0 (bright, focused beams)
- floor_color: a hex color tint for the polished wood/marble floor
- wall_color: a hex color for the matte gallery walls
- pedestal_color: a hex color for the black display pedestals
- accent_color: a hex color for metal accents, trim, and details
- floor_roughness: 0.1 to 0.5 (lower = more polished and reflective)
- floor_metalness: 0.0 to 0.3
- wall_roughness: 0.7 to 1.0 (walls are matte)
- atmosphere: a 2-3 word mood description

DIFFICULTY SCALING: Level ${levelNumber} should be ${levelNumber === 1 ? 'gentle, introducing the concept' : levelNumber === 2 ? 'moderate, more elements' : levelNumber === 3 ? 'challenging, complex connections' : 'the final test, maximum difficulty'}.

Respond as JSON matching the provided schema.`;
}

export function buildTexturePrompt(theme, surface, mapType) {
  const themeDesc = theme.description || theme.title;
  if (mapType === 'albedo') {
    if (surface === 'floor') {
      return `Seamless tileable texture: dark polished museum gallery floor. ${themeDesc}. Top-down view, PBR albedo/base color map. Rich wood planks or dark marble with subtle grain and high-end finish. Even lighting, no shadows, no highlights. Tileable seamlessly on all sides. Photorealistic, high detail.`;
    } else {
      return `Seamless tileable texture: dark matte museum gallery wall surface. ${themeDesc}. Front-facing flat view, PBR albedo/base color map. Textured plaster, dark stone, or painted paneling. Even lighting, no shadows, no highlights. Tileable seamlessly on all sides. Photorealistic, high detail.`;
    }
  } else { // height map for normal map generation
    if (surface === 'floor') {
      return `Seamless tileable GRAYSCALE heightmap of a museum gallery floor surface. ${themeDesc}. Pure grayscale only: dark areas are recessed grooves and grain depressions, light areas are raised surface. Shows plank lines, wood grain relief, or stone tile grout lines. No color. Even lighting. Tileable seamlessly on all sides. Photorealistic surface relief.`;
    } else {
      return `Seamless tileable GRAYSCALE heightmap of a dark museum gallery wall surface. ${themeDesc}. Pure grayscale only: dark areas are recessed texture, light areas are raised surface. Shows plaster texture, stone grain, or paneling relief. No color. Even lighting. Tileable seamlessly on all sides. Photorealistic surface relief.`;
    }
  }
}

export function buildInterpretationEvaluationPrompt(theme, elementA, elementB, interpretation, existingConnections, levelContext) {
  return `Evaluate the player's proposed connection between two elements in the tableau.

ELEMENT A: ${elementA.name} (${elementA.element_type})
Element A description: ${elementA.description || 'N/A'}
Element A hidden hint (player doesn't see): ${elementA.ai_narrative_hint || 'N/A'}

ELEMENT B: ${elementB.name} (${elementB.element_type})
Element B description: ${elementB.description || 'N/A'}
Element B hidden hint (player doesn't see): ${elementB.ai_narrative_hint || 'N/A'}

PLAYER'S INTERPRETATION (why should A and B be connected?):
"${interpretation.text}"

EXISTING CONNECTIONS IN THIS LEVEL:
${existingConnections.length > 0 ? existingConnections.map(c => `- ${c.summary}`).join('\n') : 'None yet (first connection)'}

LEVEL CONTEXT: ${levelContext}

YOUR TASK:
1. Evaluate if the proposed connection between A and B is understandable, viable, and narratively interesting.
2. Check compatibility with existing connections.
3. Give a preliminary score (0-100).
4. Decide if it's approved (viable enough to proceed).
5. Formulate a DEMAND to the player — ask them to create NARRATIVE MEDIA (an image, a video, or an audio clip) that ILLUSTRATES or DEMONSTRATES the connection between A and B.
   CONSTRAINTS for the demand:
   - The player creates NARRATIVE CONTENT using image, video, or audio tools. This is a narrative game — the goal is storytelling.
   - The 3D stage is ONLY for gameplay (placing elements, connecting them with ropes). NEVER demand a 3D object or 3D model.
   - The demand MUST ask for one of: an image (a scene, a portrait, a visual), a video (a short clip, an animation, a scene), or an audio (a SINGLE-voice monologue, a narration, a voice memo, an ambient sound, or music).
   - AUDIO CONSTRAINT: The player's audio tool is a single-voice text-to-speech generator. You must NEVER demand multi-character dialogue, a conversation between two or more characters, or any audio requiring more than one speaking voice. If you want audio, ask for ONE character's monologue, inner thoughts, a voice memo, a recorded confession, ambient sound, or music — never "two characters arguing" or "a dialogue".
   - The demand should be specific, creative, and tied to both elements and the player's interpretation.
   - Set expected_creation_type to "image", "audio", or "video" accordingly.

Respond as JSON matching the provided schema.`;
}

export function buildCreationEvaluationPrompt(theme, elementA, elementB, interpretation, aiRequest, creation, allElements, existingConnections) {
  return `Evaluate the player's creation that illustrates the connection between two elements.

ELEMENT A: ${elementA.name} (${elementA.element_type})
ELEMENT B: ${elementB.name} (${elementB.element_type})
PLAYER'S INTERPRETATION (why A and B are connected): "${interpretation.text}"
YOUR DEMAND: "${aiRequest.request_text}"

PLAYER'S CREATION (placed as evidence/dressing):
- Type: ${creation.creation_type}
- Description: ${creation.description || 'N/A'}
- Media URL: ${creation.media_url || 'N/A'}

ALL ELEMENTS IN TABLEAU:
${allElements.map(e => `- ${e.name} (${e.element_type})${e.is_connected ? ' [connected]' : ' [unconnected]'}`).join('\n')}

EXISTING CONNECTIONS:
${existingConnections.length > 0 ? existingConnections.map(c => `- ${c.summary}`).join('\n') : 'None yet'}

NOTE: The red rope connecting A and B appears automatically. Your evaluation is ONLY for merit points.

YOUR TASK:
1. Evaluate if the creation actually answers your demand and illustrates the A↔B connection.
2. Check if it supports the player's interpretation.
3. Check if its placement is logical.
4. Check if it works with other elements or creates contradictions.
5. Determine points change (positive for good, negative for weak/contradictory).
6. Optionally award SCKRIPT credits for exceptional work.
7. Write a narrative evaluation explaining your judgment.

Respond as JSON matching the provided schema.`;
}

export function buildGuidedVisitPrompt(theme, session, levels, connections, interpretations, creations) {
  return `You are guiding a visitor through a completed (or in-progress) narrative game tableau.

THEME: ${theme.title}
PLAYER: ${session.player_name || session.player_email}
CURRENT LEVEL: ${session.current_level}
MERIT POINTS: ${session.merit_points}

CONNECTIONS (in order):
${connections.map((c, i) => 
  `Connection ${i+1}: ${c.summary}
   AI Evaluation: ${c.ai_evaluation || 'N/A'}
   Points: ${c.points_change > 0 ? '+' : ''}${c.points_change}`
).join('\n\n')}

INTERPRETATIONS:
${interpretations.map(i => `- Element: ${i.element_name} → "${i.text}"`).join('\n')}

CREATIONS:
${creations.map(c => `- ${c.creation_type}: ${c.description || 'N/A'}`).join('\n')}

YOUR TASK:
Create a guided tour narrative that walks the visitor through the player's reasoning journey in construction order.
For each connection, explain:
- Which two elements were connected
- What vision the player described for the connection
- What demand was formulated
- What creation was produced as evidence
- Why elements were connected
- How this connection influenced the next development

The tour should help the visitor understand the player's thread of reasoning, not just see the final result.
Respond in the same language as the theme description.`;
}