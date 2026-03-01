// app/api/start-interview/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstSkill = body.skills?.[0]?.skill || "Python";
    
    return Response.json({
      success: true,
      interview_state: { started: true, currentSkill: firstSkill },
      question: {
        question: `Tell me about your experience with ${firstSkill}`,
        skill: firstSkill
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: 'Failed to start interview' }, { status: 500 });
  }
}
