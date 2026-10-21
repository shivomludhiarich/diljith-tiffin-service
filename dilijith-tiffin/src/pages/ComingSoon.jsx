import Button from '../components/common/Button';

// Temporary stand-in for pages built in later stages (auth, user portal, admin portal).
export default function ComingSoon({ title, stage }) {
  return (
    <div className="section container-x text-center">
      <h1 className="text-4xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">This page is built in {stage}. The route and access rules already work.</p>
      <div className="mt-6"><Button to="/" variant="outline">Back to home</Button></div>
    </div>
  );
}
