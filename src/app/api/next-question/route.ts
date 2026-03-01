// app/api/next-question/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Simple logic: after 2 questions per skill, move to next
    const questionCount = body.history?.filter((h: any) => h.skill === body.skill).length || 0;
    
    if (questionCount >= 2 && body.skillsRemaining?.length > 0) {
      // Move to next skill
      return Response.json({
        success: true,
        should_transition: { transition: true, next_skill: body.skillsRemaining[0] }
      });
    } else {
      // Ask another question for same skill
      const questions = [
        `Can you provide a specific example of a project where you used ${body.skill}?`,
        `What challenges have you faced while working with ${body.skill}?`,
        `How do you stay updated with the latest developments in ${body.skill}?`,
        `Can you explain a complex concept in ${body.skill} that you find interesting?`
      ];
      
      const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
      
      return Response.json({
        success: true,
        next_question: { question: randomQuestion }
      });
    }
  } catch (error) {
    return Response.json({ success: false, error: 'Failed to generate next question' }, { status: 500 });
  }
}
