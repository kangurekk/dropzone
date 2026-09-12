import CaseClient from "./CaseClient";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseClient id={id} />;
}