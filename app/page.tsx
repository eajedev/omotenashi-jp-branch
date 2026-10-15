// Fallback page — the edge middleware proxies every request to the
// origin store, so this never renders in practice.
export default function Page() {
  return <p>Omotenashi TCG — Japan Branch</p>;
}
