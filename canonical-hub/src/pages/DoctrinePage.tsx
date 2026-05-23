import doctrine from "../data/doctrine.json";

type DoctrineFile = {
  intro: string;
  nodes: {
    slug: string;
    label: string;
    path: string;
    description: string;
  }[];
};

const data = doctrine as DoctrineFile;

export function DoctrinePage() {
  return (
    <>
      <h1 className="page-title">Doctrine</h1>
      <p className="lead">{data.intro}</p>
      <div className="doctrine-grid">
        {data.nodes.map((node) => (
          <article key={node.slug} className="doctrine-node">
            <strong>{node.label}</strong>{" "}
            <code>{node.path}</code>
            <p>{node.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
