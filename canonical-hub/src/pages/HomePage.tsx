import { Link } from "react-router-dom";
import featured from "../data/featured.json";
import { SITE } from "../site";
import type { FeaturedItem } from "../types/content";

const items = featured as FeaturedItem[];

function isExternal(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function HomePage() {
  return (
    <>
      <h1 className="page-title">{SITE.tagline}</h1>
      <p className="lead">
        <strong>{SITE.name}</strong> lives at{" "}
        <span style={{ color: "var(--accent)" }}>{SITE.canonicalDomain}</span>. Live app:{" "}
        <a href={SITE.deployedUrl} rel="noopener noreferrer">
          {SITE.deployedUrl.replace(/^https:\/\//, "")}
        </a>
        .
      </p>

      <section className="section" aria-labelledby="featured-heading">
        <h2 id="featured-heading">Featured</h2>
        <div className="card-grid">
          {items.map((item) => (
            <article key={item.id} className="card">
              {isExternal(item.href) ? (
                <a className="stretch" href={item.href}>
                  <span className="pill">{item.kind}</span>
                  <h3>{item.title}</h3>
                  <p>{item.blurb}</p>
                </a>
              ) : (
                <Link className="stretch" to={item.href}>
                  <span className="pill">{item.kind}</span>
                  <h3>{item.title}</h3>
                  <p>{item.blurb}</p>
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="domains-heading">
        <h2 id="domains-heading">Domain roster (IONOS)</h2>
        <p className="domain-roster" aria-label="Registered domain names">
          {SITE.registeredDomains.join(" · ")}
        </p>
      </section>
    </>
  );
}
