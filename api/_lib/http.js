export function sendJson(response, status, data) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

export function methodNotAllowed(response) {
  response.setHeader('Allow', 'POST');
  return sendJson(response, 405, { error: 'Méthode non permise' });
}

export function handleError(response, error) {
  const status = Number(error.status || error.statusCode) || 500;
  const publicMessage = status >= 500 ? 'Erreur interne du serveur' : error.message;
  if (status >= 500) console.error(error);
  return sendJson(response, status, { error: publicMessage });
}

