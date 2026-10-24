import ProjectSpace from "@/components/ProjectSpace";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectSpace id={id} />;
}
