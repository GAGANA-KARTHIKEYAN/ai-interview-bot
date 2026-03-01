// app/api/evaluate/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Return different scores based on answer length (simple mock logic)
    const answerLength = body.answer?.length || 0;
    let score = 5; // default
    
    if (answerLength > 200) score = 8;
    else if (answerLength > 100) score = 6;
    else if (answerLength > 50) score = 4;
    else score = 3;
    
    return Response.json({
      evaluation: {
        capability: score >= 7 ? 'strong' : score >= 5 ? 'medium' : 'weak',
        confidence: score >= 7 ? 'high' : score >= 5 ? 'medium' : 'low',
        summary_feedback: score >= 7 ? 'Excellent answer with good detail!' : 
                         score >= 5 ? 'Good attempt. Try to add more specific examples.' : 
                         'Your answer was brief. Elaborate more on your experience.',
        scores: {
          technical_score: score,
          confidence_score: score,
          communication_score: score,
          behavioral_score: score - 1,
          overall_score: score
        }
      }
    });
  } catch (error) {
    return Response.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
