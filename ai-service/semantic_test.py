from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", device="cpu")
texts = ["customer support and Facebook page management", "customer service and social media management", "backend software engineering and database infrastructure"]
embeddings = model.encode(texts, normalize_embeddings=True)
related = cos_sim(embeddings[0], embeddings[1]).item()
unrelated = cos_sim(embeddings[0], embeddings[2]).item()
print({"shape": tuple(embeddings.shape), "related": related, "unrelated": unrelated})
if embeddings.shape[1] != 384 or related <= unrelated:
    raise SystemExit("Semantic test failed")
