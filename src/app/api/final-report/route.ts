// app/api/final-report/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Calculate average score
    let totalScore = 0;
    let count = 0;
    
    body.all_evaluations?.forEach((eval: any) => {
      if (eval?.scores?.overall_score) {
        totalScore += eval.scores.overall_score;
        count++;
      }
    });
    
    const avgScore = count > 0 ? totalScore / count : 6;
    const overallPercentage = Math.round(avgScore * 10);
    
    return Response.json({
      overall_score: overallPercentage,
      summary: 'Interview completed successfully. Keep practicing to improve further.',
      skill_recommendations: body.skills?.map((s: any) => ({
        skill: s.skill || s,
        recommendation: 'Continue building projects and studying advanced concepts'
      })) || []
    });
  } catch (error) {
    return Response.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
