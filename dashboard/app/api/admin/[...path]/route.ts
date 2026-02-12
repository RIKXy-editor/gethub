import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function proxyRequest(request: NextRequest, path: string) {
  const url = `${BACKEND_URL}/admin/${path}`;
  
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key !== 'host' && key !== 'connection') {
      headers[key] = value;
    }
  });
  
  const body = request.method !== 'GET' && request.method !== 'HEAD' 
    ? await request.text() 
    : undefined;
  
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
    });
    
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key !== 'transfer-encoding') {
        responseHeaders.set(key, value);
      }
    });
    
    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Backend connection failed' }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  return proxyRequest(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  return proxyRequest(request, path);
}
