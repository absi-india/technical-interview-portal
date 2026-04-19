export default async function CompletePage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;
  void inviteToken;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-12 max-w-lg text-center">
        <div className="text-5xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Interview Submitted!</h1>
        <p className="text-gray-600">
          Thank you! Your interview has been submitted successfully. The recruiter will review your responses and be in touch soon.
        </p>
      </div>
    </div>
  );
}
