import { getAuth } from "../../../../lib/auth/server";

function handlerFor(method) {
  return (request, context) => getAuth().handler()[method](request, context);
}

export const GET = handlerFor("GET");
export const POST = handlerFor("POST");
export const PUT = handlerFor("PUT");
export const PATCH = handlerFor("PATCH");
export const DELETE = handlerFor("DELETE");
