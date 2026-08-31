import { notFound } from "next/navigation";
import UserDetailCard from "@/components/admin/UserDetailCard";
import { mockAdminUsers } from "@/data/mockAdminUsers";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = mockAdminUsers.find((candidate) => candidate.id === id);

  if (!user) {
    notFound();
  }

  return <UserDetailCard user={user} />;
}
