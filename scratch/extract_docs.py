import docx
import os
import sys

def extract_text(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    print(f"\n--- EXTRACTING: {file_path} ---")
    doc = docx.Document(file_path)
    for para in doc.paragraphs:
        if para.text.strip():
            print(para.text)
    print("--- END OF FILE ---")

if __name__ == "__main__":
    files = [
        "Synopsis_Template.docx",
        "Chapter-1-7.docx",
        "Document format Details-Final.docx"
    ]
    for f in files:
        extract_text(os.path.join("c:\\Users\\gagan\\Downloads\\ai-interview-bot", f))
