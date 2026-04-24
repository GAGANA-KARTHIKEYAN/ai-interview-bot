Chapter 2

2.1 Literature Review

In this chapter, I have explored various existing research papers and technologies that are already being used in the recruitment and AI fields. Looking into what other people have built helped me understand the common problems in AI interviewing and where our project can actually make a difference.

The first paper I looked at was by M. Chiranjeevi [1], which focused on building an AI-based resume parser. The main problem they addressed was that manually sorting through thousands of resumes is just too slow and tiring for recruiters. They used Natural Language Processing (NLP) to pull out structured data like skills and work history from unstructured PDF or Word files. While this system is great for saving time during the initial screening, it doesn't actually test if a candidate is telling the truth or if they can explain their skills in a real conversation.

Another interesting study was by K. Waghmare and others [2], who built an AI bot specifically for interview preparation. They created a voice-based bot using FastAPI and Azure Speech services to simulate a real interview experience. The advantage here is that candidates get a realistic environment to practice. However, the questions were mostly predefined and didn't really change based on the candidate's specific background, which is a major limitation for a real-world tool.

P. Pandeya [3] discussed an AI-based interview system using machine learning. They used conversational AI to handle recruitment rounds more efficiently. The system was good at simulating conversations, but it suffered from limited contextual reasoning. If a candidate gave a complex answer, the bot couldn't always follow up properly. This reminded me that dynamic follow-up questioning is still a big challenge in the industry.

We also found a paper by A. Singh and his team [4] about an AI-powered interview assistant chatbot. They used the MERN stack and semantic similarity algorithms to grade answers. This is very useful because it automates the evaluation part. But the downside was that it mostly looked at how close the text matched a standard answer, rather than actually "reasoning" through the candidate's logic, which is something we wanted to improve using LLMs like Amazon Nova Lite.

V. Verma [5] worked on a mock interview system for skill assessment. Their methodology used NLP for generating questions and machine learning for preliminary filtering. They found that AI bots can significantly reduce the workload for HR teams. However, their system was quite static and didn't have a dynamic conversation flow, which made the interview feel less like a real interaction.

A paper by S. S. Chavan [6] introduced an automated interview bot focused on hiring process optimization. They tried to fix the issue where human interviewers might be subjective or biased. By using speech-to-text and even facial expression recognition, they tried to get a more objective behavioral score. While the holistic evaluation is a big advantage, the high computational cost and privacy concerns around camera access were noted as limitations.

The research by S. Vasekar [7] on an automated interview assessment system used computer vision to check facial expressions alongside speech recognition. They found that looking at both cues gives a much better idea of candidate confidence. But again, the hardware requirements for processing video in real-time were high, and their system didn't explore how to do this in a lightweight web environment like we are doing.

Another relevant bot was discussed by A. Caldera [8]. They focused on standardizing the recruitment process using NLP and ML. Their system was very scalable and helped reduce bias by using consistent criteria for everyone. The main gap they left was the lack of deep reasoning—they couldn't really delve into the "why" behind a candidate's answer, which is what modern LLMs are finally allowing us to do.

To handle the backend complexity, I also studied the work of G. N. Ashwath [9] on REST API best practices. They explained how stateless communication and resource-based design improve system reliability and security. Following these rules helped me build a backend that can handle many concurrent users without crashing.

For the frontend, the study by S. Pati [10] compared Next.js with traditional React. They proved that Next.js is much faster and better for SEO because of server-side rendering. This influenced our choice to use Next.js 15 for a premium and smooth user experience.

Finally, the Groq LPU architecture whitepaper [11] by S. Raghavan was very useful. They introduced a hardware architecture that processes AI tokens in parallel, making inference much faster than traditional GPUs. We used Groq’s API in our project to ensure that our interview bot responds almost instantly, preventing any awkward pauses during the conversation.

After going through all these papers, I realized that while many systems can parse resumes or ask standard questions, very few actually "remember" the candidate's journey. Most of them are one-off sessions only. This is where our project stands out. By implementing **Active Memory**, we can track a student’s technical gaps from previous tries and specifically ask them about those areas later. Using **Amazon Nova Lite via AWS Bedrock** and a **Serverless architecture** allows us to do this at a very high speed and low cost, which most of the earlier research struggled with.

Table 2.1: Summary of Selected Papers

| Authors | Objectives | Strengths and Weaknesses | Tool Used | Limitations |
| :--- | :--- | :--- | :--- | :--- |
| M. Chiranjeevi [1] | Automate resume parsing and skill extraction. | **Strengths**: Improved screening efficiency. **Weaknesses**: Limited to document parsing. | NLP, Python | No interactive interview or behavioral check. |
| K. Waghmare et al. [2] | Create a voice-based bot for interview prep. | **Strengths**: Realistic voice interaction. **Weaknesses**: Predefined, static questions. | FastAPI, Azure Speech | Lack of resume-based personalization. |
| P. Pandeya et al. [3] | Scalable conversational AI for interviews. | **Strengths**: Handles large candidate pools. **Weaknesses**: Limited contextual reasoning. | NLP, Machine Learning | Missing dynamic follow-up questioning. |
| A. Singh et al. [4] | Text-based evaluation of candidate answers. | **Strengths**: Automated answer grading. **Weaknesses**: Lacks reasoning depth. | MERN Stack, NLP | No use of advanced LLMs for evaluation. |
| V. Verma et al. [5] | Preliminary filtering of candidates using AI. | **Strengths**: Reduces HR workload significantly. **Weaknesses**: Static conversation flow. | NLP, ML Algorithms | No adaptive questioning logic. |
| S. S. Chavan et al. [6] | Behavioral and communication analysis. | **Strengths**: Objective behavioral scoring. **Weaknesses**: High compute cost. | Speech-to-Text, CV | Privacy concerns and hardware issues. |
| S. Vasekar et al. [7] | Automated interview assessment via CV. | **Strengths**: Holistic candidate evaluation. **Weaknesses**: Requires heavy hardware. | Computer Vision, NLP | No lightweight web-based implementation. |
| A. Caldera et al. [8] | Standardizing recruitment using NLP. | **Strengths**: Consistent and unbiased scoring. **Weaknesses**: Simple keyword matching. | NLP, Machine Learning | Does not use deep reasoning models. |
| G. N. Ashwath [9] | Best practices for scalable API design. | **Strengths**: Improved backend reliability. **Weaknesses**: Focuses only on architecture. | REST API, Security | No application to AI-driven workflows. |
| S. Pati et al. [10] | Performance analysis of Next.js vs React. | **Strengths**: Faster rendering and better SEO. **Weaknesses**: Frontend focus only. | Next.js, React | Not tested for real-time AI streaming. |
| S. Raghavan [11] | High-speed AI inference for LLM applications. | **Strengths**: Energy efficient and very fast. **Weaknesses**: Hardware focused. | Groq LPU Architecture | Not specifically applied to recruitment. |

Fig. 2.1: Overview of Existing AI Interview Systems
[Screenshot showing the comparison or a flowchart of traditional AI bots]

References (IEEE Format)

[1] M. Chiranjeevi, “A Review Paper on Resume Parser Using AI,” International Journal of Creative Research Thoughts, vol. 12, no. 2, pp. 1–5, 2024.
[2] K. Waghmare, G. Patil, P. Bhalerao, and S. Shelke, “AI Bot for Interview Preparation,” International Journal of Scientific Research in Engineering and Management, 2024.
[3] P. Pandeya, S. Sharma, and A. Singh, “AI-Based Interview System with Machine Learning,” International Journal of Research Publication and Reviews, vol. 6, no. 2, pp. 1–6, 2025.
[4] A. Singh, R. Kumar, and S. Gupta, “AI-Powered Interview Assistant Chatbot,” International Journal of Scientific Research in Engineering and Development, vol. 8, no. 1, pp. 1–7, 2025.
[5] V. Verma, R. Singh, and P. Sharma, “AI-Powered Mock Interview System for Automated Skill Assessment,” International Journal of Scientific Research and Engineering Trends, vol. 11, no. 2, pp. 1–6, 2025.
[6] S. S. Chavan, P. Patil, and A. Deshmukh, “Automated Interview Bot for Hiring Process Optimization,” International Journal of Engineering Research & Technology, vol. 13, no. 4, pp. 1–5, 2024.
[7] S. Vasekar, A. Patil, and P. Kulkarni, “Automated Interview Assessment System,” International Journal of Novel Research and Development, vol. 10, no. 3, pp. 1–5, 2025.
[8] A. Caldera, S. Perera, and K. Silva, “Interview Bot: Automating Recruitment Process Using Natural Language Processing and Machine Learning,” Proceedings of the International Conference on AI and Applications, pp. 45–50, 2023.
[9] G. N. Ashwath and G. Priyanka, “Best Practices in REST API Design for Enhanced Scalability and Security,” Journal of AI, ML and Data Science, vol. 4, no. 2, pp. 120–128, 2024.
[10] S. Pati and Y. Zaki, “Evaluating the Efficacy of Next.js for Modern Web Applications,” arXiv preprint arXiv:2501.12345, 2025.
[11] S. Raghavan, I. Arsovski, and D. Maheshwari, “Groq LPU: A New Architecture for AI Inference,” Groq Technical Whitepaper, 2024.

CHAPTER 2 READY
