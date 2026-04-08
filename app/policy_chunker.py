import re
from pypdf import PdfReader

def load_pdf_text(path: str) -> str:
    try:
        reader = PdfReader(path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        return f"Error reading PDF: {e}"

def smart_chunk(text: str):
    # split by generic sections (e.g., "1. Purpose", "2. Employee Grade")
    sections = re.split(r'\n(?=\d+\.\s)', text)
    
    chunks = []
    for i, sec in enumerate(sections):
        sec_text = sec.strip()
        if len(sec_text) > 50:
            # Try to identify the section title
            lines = sec_text.split('\n')
            section_title = lines[0][:50] if lines else "General Policy"
            
            chunks.append({
                "text": sec_text,
                "section": section_title.strip(),
                "id": i
            })
            
    return chunks

def create_policy_chunks(pdf_path: str):
    text = load_pdf_text(pdf_path)
    if text.startswith("Error"):
        return []
    chunks = smart_chunk(text)
    return chunks
