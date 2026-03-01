import pdfplumber
from docx import Document
from fastapi import UploadFile

def extract_text_from_file(file: UploadFile) -> str:
    file.file.seek(0)
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        text = ""
        with pdfplumber.open(file.file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()

    elif filename.endswith(".docx"):
        doc = Document(file.file)
        return "\n".join(para.text for para in doc.paragraphs if para.text.strip())

    else:
        raise ValueError("Only PDF and DOCX files are supported")
