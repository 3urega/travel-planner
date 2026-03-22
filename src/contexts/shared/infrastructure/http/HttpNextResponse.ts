import { NextResponse } from "next/server";

export class HttpNextResponse {
  static json<T>(data: T, status: number = 200): NextResponse {
    return NextResponse.json(data, { status });
  }

  static badRequest(message: string): NextResponse {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  static internalError(message: string): NextResponse {
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
