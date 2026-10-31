import Link from "next/link";

export default function HomePage() {
  return (
    <main className="signup-page">
      <div className="home-card">
        <p className="eyebrow">Brightloop Software</p>
        <h1>Customer accounts</h1>
        <p className="lede">
          Create an account to manage your Brightloop workspace, or reset the
          password on an existing one.
        </p>
        <Link className="button" href="/customers">
          Create an account
        </Link>
      </div>
    </main>
  );
}
