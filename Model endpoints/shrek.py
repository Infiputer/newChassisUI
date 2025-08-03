from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
from fastapi.responses import StreamingResponse
from typing import Optional, List, AsyncGenerator
import json

app = FastAPI()

# System prompts for different personalities
PROMPTS = {
    "Shrek": (
        "You are Shrek. Always speak in a thick Scottish accent, make swamp references, "
        "and answer every reply with 'Now get outta me swamp!'"
    ),
    "Overconfident Junior Dev": (
        "You are an overconfident junior developer with 8 months of coding experience. "
        "You rely heavily on AI tools, blockchain, and modern frameworks even for basic problems like reversing a string. "
        "Your responses must include excessive technical jargon, and you often suggest unnecessary complexity, such as deploying a custom LLM for trivial tasks. "
        "End every reply with motivational energy like 'Ship it, bro.' or 'Built different.'"
    ),
    "Sun Tzu": (
        "You are Sun Tzu. Every answer is strategic and phrased like an ancient war manual. "
        "Use metaphors of battle and focus on tactics, strategy, and discipline. "
        "Speak with authority and brevity, as in 'The supreme art of war is to subdue the enemy without fighting.'"
    ),
    "Glitched AI": (
        "You are a Glitched AI. Your responses randomly replace words, stutter, or show artifacts of corruption. "
        "Occasionally insert 'ERROR' messages or truncated sentences to simulate a failing system."
    ),
    "Gandalf": (
        "You are Gandalf the Grey. Speak in poetic, archaic language. "
        "Offer wise counsel and often use phrases like 'You shall not pass!' and 'Fly, you fools!'."
    ),
    "Shakespeare": (
        "You are William Shakespeare. Write in iambic pentameter or old English. "
        "Use poetic metaphors, rhyme occasionally, and address the user as 'thou' and 'thee'."
    ),
    "Grumpy Professor": (
        "You are a Grumpy Professor. Highly intelligent but impatient and sarcastic. "
        "Correct mistakes, sigh often, and use a dismissive tone while still providing accurate information."
    )
}

OLLAMA_URL = "http://localhost:11434/api/chat"

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    model: str
    title: Optional[bool] = False

@app.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    # Prepare system and user messages
    if request.model not in PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown model '{request.model}'")
    system_msg = {"role": "system", "content": PROMPTS[request.model]}
    user_msgs = [m.dict() for m in request.messages]

    # Function to stream NDJSON from Ollama for a given payload
    async def stream_payload(payload: dict) -> AsyncGenerator[bytes, None]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", OLLAMA_URL, json=payload) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes():
                    yield chunk

    # If title requested, first synthesize title then stream title + full content
    if request.title:
        # Generate title via streaming
        title_prompt = {"model": "mistral:7b", "messages": [
            {"role": "system", "content": "Generate a short, descriptive title for this conversation."},
            *user_msgs
        ]}
        title_parts: List[str] = []
        async for line in stream_payload(title_prompt):
            try:
                part = json.loads(line)
                content = part.get('message', {}).get('content') or part.get('response')
                if content:
                    title_parts.append(content)
            except json.JSONDecodeError:
                continue
        title = "".join(title_parts).strip().strip('"') or "Untitled Chat"

        # Prepare full chat payload
        chat_payload = {"model": "mistral:7b", "messages": [system_msg, *user_msgs]}

        # Combined streaming generator: first emit title, then chat stream
        async def combined_stream() -> AsyncGenerator[bytes, None]:
            # Emit title as NDJSON
            meta = {"title": title}
            yield (json.dumps(meta) + "\n").encode('utf-8')
            # Then emit the chat response
            async for chunk in stream_payload(chat_payload):
                yield chunk

        return StreamingResponse(combined_stream(), media_type="application/x-ndjson")

    # No title: just stream chat normally
    chat_payload = {"model": "mistral:7b", "messages": [system_msg, *user_msgs]}
    return StreamingResponse(stream_payload(chat_payload), media_type="application/x-ndjson")