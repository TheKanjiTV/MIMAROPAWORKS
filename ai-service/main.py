"""Local, CPU-only semantic matching service for MIMAROPA Works."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi import UploadFile, File
import pymupdf
import re
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
model: SentenceTransformer | None = None

@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    model = SentenceTransformer(MODEL_NAME, device="cpu")
    yield
    model = None

app = FastAPI(title="MIMAROPA Works AI", lifespan=lifespan)
SKILLS = {"customer service": ["customer service", "customer support", "client support"], "canva": ["canva"], "social media management": ["social media management", "fb page management", "facebook management", "social media handling"], "microsoft excel": ["microsoft excel", "ms excel", "excel"], "microsoft office": ["microsoft office", "ms office"], "communication": ["communication"], "bookkeeping": ["bookkeeping"], "data entry": ["data entry"], "python": ["python"], "javascript": ["javascript"], "react": ["react"], "driving": ["driving"]}

def analyze_text(text: str):
    lower = text.lower()
    skills = [name.title() if name != 'canva' else 'Canva' for name, aliases in SKILLS.items() if any(re.search(r'(?<!\w)' + re.escape(alias) + r'(?!\w)', lower) for alias in aliases)]
    education = next((value for value in ["Master's Degree", "Bachelor's Degree", "College Undergraduate", "Vocational / TESDA", "Senior High School"] if value.lower().replace(' / ', ' ').split()[0] in lower), None)
    course = next((course for course in ['Business Administration', 'Information Technology', 'Computer Science', 'Marketing', 'Accountancy'] if course.lower() in lower), None)
    titles = re.findall(r'(?im)^\s*((?:customer service representative|administrative assistant|marketing assistant|software developer|technical support representative))\s*$', text)
    snippets = [line.strip() for line in re.split(r'[\r\n]+', text) if re.search(r'(?i)(handled|responded|assisted|managed|supported)', line)][:3]
    return {"detected_skills": skills, "detected_education": education, "detected_course": course, "detected_job_titles": titles, "experience_snippets": snippets}

class SemanticRequest(BaseModel):
    candidate_text: str = Field(min_length=1, max_length=20000)
    job_text: str = Field(min_length=1, max_length=20000)

@app.get('/health')
def health():
    if model is None:
        raise HTTPException(status_code=503, detail="Model is still loading.")
    return {"status": "ok", "model": MODEL_NAME.rsplit('/', 1)[1], "embedding_dimension": model.get_embedding_dimension()}

@app.post('/ai/semantic-score')
def semantic_score(request: SemanticRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is still loading.")
    embeddings = model.encode([request.candidate_text, request.job_text], normalize_embeddings=True)
    # Normalized vectors: dot product is cosine similarity. Clamp negative values safely.
    cosine = float(embeddings[0] @ embeddings[1])
    score = max(0.0, min(1.0, cosine))
    return {"semantic_score": score, "engine": "sentence_transformer", "model": MODEL_NAME.rsplit('/', 1)[1]}

@app.post('/ai/resume/analyze')
async def resume_analyze(file: UploadFile = File(...)):
    data = await file.read()
    try:
        document = pymupdf.open(stream=data, filetype='pdf')
        pages = [page.get_text() for page in document]
        document.close()
    except Exception as error:
        raise HTTPException(status_code=400, detail='The PDF could not be read.') from error
    text = re.sub(r'\n{3,}', '\n\n', re.sub(r'[\t ]+', ' ', '\n'.join(pages))).strip()
    base = {"status": "completed", "page_count": len(pages), "resume_text_available": bool(text)}
    return base | (analyze_text(text) if text else {"detected_skills": [], "detected_education": None, "detected_course": None, "detected_job_titles": [], "experience_snippets": []})
