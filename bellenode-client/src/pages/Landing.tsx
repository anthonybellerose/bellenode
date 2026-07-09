import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-bg text-gray-200">
      <header className="max-w-3xl mx-auto px-5 pt-10 pb-6 text-center">
        <h1 className="text-4xl font-bold text-white tracking-wider">BELLENODE</h1>
        <p className="text-gray-400 mt-3 text-base">
          La gestion d'inventaire et des commandes SAQ, simplifiée pour les bars et restaurants du Québec.
        </p>
        <span className="badge badge-yellow mt-5 inline-flex">🚧 Présentement en développement</span>
      </header>

      <main className="max-w-3xl mx-auto px-5 pb-16 space-y-6">
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">C'est quoi, Bellenode ?</h2>
          <p className="text-gray-300 leading-relaxed">
            Bellenode est une application pensée pour que la gestion de l'alcool dans un bar ou un
            restaurant devienne invisible : on scanne l'inventaire, l'application calcule automatiquement
            ce qu'il faut commander, et prépare la commande SAQ. L'objectif : que le propriétaire ou le
            gérant n'ait plus jamais à y penser — juste à aller chercher sa commande chaque semaine.
          </p>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Où on en est</h2>
          <p className="text-gray-300 leading-relaxed">
            Bellenode est en développement actif. Ce n'est pas encore une plateforme ouverte au grand
            public — l'application est actuellement testée avec un premier groupe de restaurants
            partenaires avant un lancement plus large.
          </p>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Fait au Québec</h2>
          <p className="text-gray-300 leading-relaxed">
            Bellenode est conçu et développé au Québec, par quelqu'un qui travaille lui-même chaque jour
            dans un restaurant. L'application est pensée pour la réalité concrète d'un bar ou d'un
            restaurant d'ici — les commandes SAQ, les formats de bouteilles, les habitudes du terrain —
            pas comme un logiciel générique adapté après coup.
          </p>
        </section>

        <section className="card p-6 text-center">
          <h2 className="text-lg font-semibold text-white mb-2">Envie d'être parmi les premiers ?</h2>
          <p className="text-gray-400 text-sm mb-4">
            On accepte présentement quelques restaurants pilotes pour tester l'application.
          </p>
          <a
            href="mailto:abellerose@bellenode.com?subject=Bellenode%20—%20restaurant%20pilote"
            className="btn btn-primary inline-flex"
          >
            Nous écrire
          </a>
        </section>

        <p className="text-center text-gray-500 text-sm pt-2">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-accent hover:underline">Se connecter</Link>
        </p>
      </main>
    </div>
  );
}
