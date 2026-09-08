import UserDetailCard from "@/components/admin/UserDetailCard";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailCard userId={id} />;
}
