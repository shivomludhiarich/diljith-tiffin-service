import Button from '../components/common/Button';

export default function NotFound() {
  return (
    <div className="section container-x text-center">
      <h1 className="text-5xl">Page not found</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">That page doesn&apos;t exist or has moved. Head back home or check our meal rates.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button to="/">Go home</Button>
        <Button to="/plans" variant="outline">View meal rates</Button>
      </div>
    </div>
  );
}
