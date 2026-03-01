// app/api/upload-and-analyze/route.ts
export async function POST(request: Request) {
  try {
    // Return mock skills data
    return Response.json({
      matched_skills: [
        { skill: "Python", experience_level: "intermediate", category: "language", typical_questions: ["Explain Python decorators", "What are list comprehensions?"] },
        { skill: "JavaScript", experience_level: "intermediate", category: "language", typical_questions: ["Explain closures", "How does the event loop work?"] },
        { skill: "React", experience_level: "intermediate", category: "framework", typical_questions: ["Explain the virtual DOM", "What are hooks?"] },
        { skill: "Node.js", experience_level: "intermediate", category: "framework", typical_questions: ["How does event loop work?", "Explain middleware"] },
        { skill: "SQL", experience_level: "intermediate", category: "database", typical_questions: ["Explain JOIN types", "What's normalization?"] },
        { skill: "Git", experience_level: "intermediate", category: "tool", typical_questions: ["Explain branching strategy", "How to resolve conflicts?"] }
      ]
    });
  } catch (error) {
    return Response.json({ error: 'Failed to analyze CV' }, { status: 500 });
  }
}
