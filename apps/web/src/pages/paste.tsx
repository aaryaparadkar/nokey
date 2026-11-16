import { useParams } from "react-router";
import { Placeholder } from "./placeholder";

export function PastePage() {
  const { id } = useParams();
  return <Placeholder title={`Paste ${id}`} />;
}
