import { AccessDeniedPageDialog } from "./page-dialog";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module } = await searchParams;
  return <AccessDeniedPageDialog module={module ?? "this module"} />;
}
