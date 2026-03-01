// app/api/generate-skill-summary/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    return Response.json({
      skill: body.skill,
      proficiency_level: 'intermediate',
      strengths: ['Good foundational knowledge', 'Clear communication', 'Understands core concepts'],
      weaknesses: ['Could provide more real-world examples', 'Depth could be improved'],
      summary: `Shows solid intermediate proficiency in ${body.skill}. With more practice and real-world projects, can advance to expert level.`
    });
  } catch (error) {
    return Response.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
