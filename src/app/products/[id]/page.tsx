import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { checkProductNow } from "../../actions";

export const dynamic = "force-dynamic";

const currency = config.currencySymbol;

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : `${currency}${n.toFixed(2)}`;
}

function ts(d: Date | null | undefined, withSeconds = false): string {
  if (!d) return "—";
  const iso = new Date(d).toISOString();
  return withSeconds ? iso.slice(0, 19).replace("T", " ") : iso.slice(0, 16).replace("T", " ");
}

export default async function ProductDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      history: { orderBy: { fetchedAt: "desc" }, take: 100 },
      alerts: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!product) notFound();

  return (
    <>
      <p>
        <a href="/" className="muted">
          ← Back to dashboard
        </a>
      </p>

      <section className="panel">
        <h2>{product.name}</h2>
        <dl className="meta">
          <dt>Goods ID</dt>
          <dd>{product.goodsId}</dd>
          <dt>Threshold</dt>
          <dd>{fmt(product.thresholdPrice)}</dd>
          <dt>Current price</dt>
          <dd>
            {fmt(product.lastPrice)}{" "}
            {product.isBelowThreshold && <span className="badge badge-hit">below ✓</span>}
          </dd>
          <dt>Fetcher</dt>
          <dd>{product.fetcher}</dd>
          {product.url && (
            <>
              <dt>Link</dt>
              <dd>
                <a href={product.url} target="_blank" rel="noopener noreferrer">
                  {product.url}
                </a>
              </dd>
            </>
          )}
          {product.lastError && (
            <>
              <dt>Last error</dt>
              <dd className="error">{product.lastError}</dd>
            </>
          )}
        </dl>
        <form action={checkProductNow} className="inline">
          <input type="hidden" name="id" value={product.id} />
          <button className="btn btn-primary">Check now</button>
        </form>
      </section>

      {product.alerts.length > 0 && (
        <section className="panel">
          <h2>Alert history</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>When</th>
                <th>Price</th>
                <th>Threshold</th>
                <th>Channels</th>
              </tr>
            </thead>
            <tbody>
              {product.alerts.map((a) => (
                <tr key={a.id}>
                  <td className="small">{ts(a.createdAt)}</td>
                  <td>{fmt(a.price)}</td>
                  <td>{fmt(a.thresholdPrice)}</td>
                  <td className="small">{a.channels || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel">
        <h2>
          Price history <span className="muted small">(latest {product.history.length})</span>
        </h2>
        {product.history.length === 0 ? (
          <p className="muted">No checks recorded yet.</p>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>When</th>
                <th>Price</th>
                <th>List price</th>
                <th>In stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {product.history.map((h) => (
                <tr key={h.id}>
                  <td className="small">{ts(h.fetchedAt, true)}</td>
                  <td>
                    {fmt(h.price)}{" "}
                    {h.price != null && h.price <= product.thresholdPrice && (
                      <span className="badge badge-hit small">≤ threshold</span>
                    )}
                  </td>
                  <td className="muted">{fmt(h.originalPrice)}</td>
                  <td>{h.inStock ? "✓" : "✗"}</td>
                  <td>
                    {h.ok ? (
                      <span className="badge badge-ok small">ok</span>
                    ) : (
                      <span className="badge badge-warn small" title={h.error ?? ""}>
                        error
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
