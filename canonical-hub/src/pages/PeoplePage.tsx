import people from "../data/people.json";
import type { PersonCard } from "../types/content";

const list = people as PersonCard[];

export function PeoplePage() {
  return (
    <>
      <h1 className="page-title">People</h1>
      <p className="lead">
        One image-line-link per human beats an anonymous pile of files. Edit{" "}
        <code>src/data/people.json</code> to grow this wall.
      </p>
      <div className="card-grid">
        {list.map((p) => (
          <article key={p.id} className="card">
            <a className="stretch" href={p.href}>
              {p.role ? <span className="pill">{p.role}</span> : null}
              <h3>{p.displayName}</h3>
              <p>{p.tagline}</p>
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
