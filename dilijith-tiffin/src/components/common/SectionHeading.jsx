export default function SectionHeading({ title, subtitle, center = true }) {
  return (
    <div className={`mb-10 max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      <span aria-hidden="true" className={`mt-3 block h-1 w-10 rounded-full bg-danger ${center ? 'mx-auto' : ''}`} />
      {subtitle && <p className="mt-4 text-muted">{subtitle}</p>}
    </div>
  );
}
