import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { availableFetchers } from "@/lib/fetchers";
import { buildDefaultManager } from "@/lib/notifiers";
import {
  addProduct,
  checkAllNow,
  checkProductNow,
  deleteProduct,
  toggleProduct,
} from "./actions";

// Always render fresh — this page reflects live monitoring state.
export const dynamic = "force-dynamic";

const currency = config.currencySymbol;

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : `${currency}${n.toFixed(2)}`;
}

function statusBadge(p: {
  active: boolean;
  lastError: string | null;
  isBelowThreshold: boolean;
  lastPrice: number | null;
}) {
  if (!p.active) return <span className="badge badge-muted">paused</span>;
  if (p.lastError)
    return (
      <span className="badge badge-warn" title={p.lastError}>
        error
      </span>
    );
  if (p.isBelowThreshold) return <span className="badge badge-hit">below ✓</span>;
  if (p.lastPrice != null) return <span className="badge badge-ok">above</span>;
  return <span className="badge badge-muted">pending</span>;
}

export default async function Dashboard() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  const channels = buildDefaultManager().channelNames;
  const fetchers = availableFetchers();

  return (
    <>
      <section className="panel">
        <h2>Watched products</h2>
        <p className="muted">
          Alerts fire when a product&apos;s price drops to or below its threshold. Active
          alert channels:{" "}
          {channels.map((c) => (
            <span className="chip" key={c}>
              {c}
            </span>
          ))}
        </p>

        <form action={checkAllNow} className="inline">
          <button type="submit" className="btn">
            Check all now
          </button>
        </form>

        {products.length === 0 ? (
          <p className="muted">No products yet. Add one below to start monitoring.</p>
        ) : (
          <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Product</th>
                <th>Current</th>
                <th>Threshold</th>
                <th>Status</th>
                <th>Fetcher</th>
                <th>Last checked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.isBelowThreshold ? "row-hit" : ""}>
                  <td>
                    <a href={`/products/${p.id}`}>{p.name}</a>
                    <div className="muted small">{p.goodsId}</div>
                  </td>
                  <td>{fmt(p.lastPrice)}</td>
                  <td>{fmt(p.thresholdPrice)}</td>
                  <td>{statusBadge(p)}</td>
                  <td>{p.fetcher}</td>
                  <td className="muted small">
                    {p.lastCheckedAt
                      ? new Date(p.lastCheckedAt).toISOString().slice(0, 16).replace("T", " ")
                      : "never"}
                  </td>
                  <td className="actions">
                    <form action={checkProductNow} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn btn-sm">Check</button>
                    </form>
                    <form action={toggleProduct} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn btn-sm">{p.active ? "Pause" : "Resume"}</button>
                    </form>
                    <form action={deleteProduct} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn btn-sm btn-danger">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Add a product to watch</h2>
        <form action={addProduct} className="form-grid">
          <label>
            Name
            <input type="text" name="name" required placeholder="e.g. Anker charger" />
          </label>
          <label>
            Goods ID / URL
            <input
              type="text"
              name="goods_id"
              required
              placeholder="PDD goods_id or share link"
            />
          </label>
          <label>
            Threshold price ({currency})
            <input
              type="number"
              name="threshold_price"
              step="0.01"
              min="0.01"
              required
              placeholder="99.00"
            />
          </label>
          <label>
            Product URL (optional)
            <input type="text" name="url" placeholder="https://mobile.yangkeduo.com/..." />
          </label>
          <label>
            Fetcher
            <select name="fetcher" defaultValue={config.defaultFetcher}>
              {fetchers.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Add product
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
