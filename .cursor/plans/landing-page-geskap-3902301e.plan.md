<!-- 3902301e-0471-4eb4-bd7d-301191b8fbe9 0921caff-51b5-49ba-948f-88661eccc596 -->
# Plan d'implémentation - Landing Page Geskap

## Objectif

Créer une landing page moderne et complète pour Geskap, inspirée du design Shopify POS, avec toutes les sections marketing définies dans `landing.md`.

## Structure des fichiers

### 1. Installation des dépendances

- Ajouter `framer-motion` pour les animations au scroll
- Commande: `npm install framer-motion`

### 2. Page principale

- **Fichier**: `src/pages/Landing.tsx`
- Composant principal qui orchestre toutes les sections
- Layout sans sidebar/navbar (landing page standalone)

### 3. Composants de landing (`src/components/landing/`)

- `LandingHeader.tsx` - Header sticky avec logo, navigation, CTAs
- `HeroSection.tsx` - Section hero avec headline, sous-titre, CTA principal
- `WhyGeskapSection.tsx` - Section "Pourquoi Geskap" avec 3 sous-sections
- `UseCasesSection.tsx` - 3 cartes horizontales (Boutique unique, Multi-points, E-commerce)
- `FeaturesGridSection.tsx` - Grille de 6-8 fonctionnalités principales
- `PaymentSection.tsx` - Section CinetPay avec fond vert foncé
- `AllFeaturesSection.tsx` - Liste complète des fonctionnalités (fond beige)
- `GettingStartedSection.tsx` - 3 étapes numérotées
- `ResourcesSection.tsx` - 3 cartes de ressources avec images
- `FAQSection.tsx` - FAQ avec accordéon (fond sombre)
- `FinalCTASection.tsx` - CTA finale avec fond vert
- `LandingFooter.tsx` - Footer complet avec navigation

### 4. Composants réutilisables

- `FeatureCard.tsx` - Carte de fonctionnalité réutilisable
- `UseCaseCard.tsx` - Carte de cas d'usage avec image
- `ResourceCard.tsx` - Carte de ressource avec image
- `FAQItem.tsx` - Item FAQ avec accordéon (état ouvert/fermé)
- `SectionContainer.tsx` - Wrapper pour sections avec fonds alternés

### 5. Modifications du routing

- **Fichier**: `src/App.tsx`
- Remplacer la ligne 81: `<Route path="/" element={<Navigate to="/auth/login" replace />} />`
- Par: Route vers `Landing` component (lazy loaded)
- Ajouter route `/auth/login` explicite pour l'accès direct

## Design & Style

### Palette de couleurs (charte graphique)

- Fond principal: `bg-white`
- Fond alterné: `bg-[#f5f5f0]` (beige clair)
- Fond sombre: `bg-theme-forest` (#183524)
- Fond accent: `bg-emerald-600` ou `bg-theme-olive`
- Texte: `text-gray-900`, `text-white` sur fond sombre
- CTAs: `bg-black text-white` ou `bg-theme-forest text-white`

### Typographie

- Headlines: `text-5xl` ou `text-6xl`, `font-bold`, `font-title` (Tan Mon Cheri)
- Sous-titres: `text-xl` ou `text-2xl`, `text-gray-600`
- Body: `text-base` ou `text-lg`, `text-gray-700`

### Layout

- Conteneur max-width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Sections: `py-20` ou `py-24` (espacement vertical généreux)
- Grilles: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

### Header sticky

- Position: `fixed top-0 left-0 right-0 z-50`
- Background: `bg-white` avec `backdrop-blur-sm` et `shadow-sm`
- Logo: Cercle vert avec forme blanche + texte "GESKAP"
- Navigation: Liens "Business Sizes", "Industries", "Features", "Pricing"
- CTAs: "Log in" (lien) + "Get started" (bouton noir)

## Animations (framer-motion)

### Scroll animations

- Utiliser `motion` components de framer-motion
- `initial={{ opacity: 0, y: 50 }}`
- `whileInView={{ opacity: 1, y: 0 }}`
- `viewport={{ once: true, margin: "-100px" }}`
- `transition={{ duration: 0.6 }}`

### Hover effects

- Cartes: `hover:shadow-lg`, `hover:scale-105`, `transition-all duration-300`
- Boutons: `hover:bg-gray-900`, `hover:scale-105`

### FAQ accordéon

- Utiliser `motion.div` avec `animate={{ height: isOpen ? "auto" : 0 }}`
- Transition smooth pour l'ouverture/fermeture

## Images & Assets

### Placeholders temporaires

- Utiliser `/placeholder.png` existant pour toutes les images
- Créer des composants avec `ImageWithSkeleton` existant
- Structure: `public/landing/` pour futures images de stock

### Images nécessaires

- Hero: Dashboard Geskap (placeholder pour l'instant)
- Use Cases: 3 images (boutique, multi-points, e-commerce)
- Resources: 3 images pour les cartes de ressources
- Payment Section: Image illustrant paiements mobiles

## Responsive Design

### Breakpoints Tailwind

- Mobile: `< 768px` (default)
- Tablet: `md: >= 768px`
- Desktop: `lg: >= 1024px`

### Adaptations

- Navigation: Menu hamburger sur mobile
- Grilles: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Headlines: `text-3xl sm:text-4xl lg:text-6xl`
- Images: `object-cover`, tailles adaptatives

## Contenu

### Source

- Tout le contenu est défini dans `landing.md`
- Extraire les textes pour chaque section
- Utiliser `useTranslation` si nécessaire (i18n)

### CTAs

- "Commencer gratuitement" → `/auth/register`
- "Voir la démo" → `/demo` (route à créer ou modal)
- "Log in" → `/auth/login`

## Performance

### Optimisations

- Lazy loading des images avec `loading="lazy"`
- Code splitting: Landing page lazy loaded dans App.tsx
- Images: Utiliser `ImageWithSkeleton` existant
- Animations: `viewport={{ once: true }}` pour éviter re-animations

## Tests

### Points à vérifier

- Header sticky fonctionne correctement
- Animations au scroll se déclenchent
- FAQ accordéon ouvre/ferme correctement
- Responsive sur mobile/tablet/desktop
- CTAs redirigent vers les bonnes routes
- Images se chargent avec placeholder

## Ordre d'implémentation

1. Installation framer-motion
2. Création structure de dossiers
3. Composants réutilisables (FeatureCard, UseCaseCard, etc.)
4. Header sticky
5. Hero Section
6. Sections une par une (WhyGeskap, UseCases, Features, etc.)
7. FAQ avec accordéon
8. Footer
9. Page Landing.tsx qui assemble tout
10. Modification routing dans App.tsx
11. Tests responsive et animations
12. Optimisations performance

### To-dos

- [ ] Installer framer-motion pour les animations au scroll: npm install framer-motion
- [ ] Créer la structure de dossiers: src/components/landing/ et préparer les fichiers de base
- [ ] Créer les composants réutilisables: FeatureCard, UseCaseCard, ResourceCard, FAQItem, SectionContainer
- [ ] Créer LandingHeader.tsx avec navigation sticky, logo Geskap, liens de navigation et CTAs
- [ ] Créer HeroSection.tsx avec headline, sous-titre, CTA principal et visuel (placeholder pour l'instant)
- [ ] Créer WhyGeskapSection.tsx avec les 3 sous-sections (Démarrage rapide, Fiable, Intégré)
- [ ] Créer UseCasesSection.tsx avec 3 cartes horizontales (Boutique unique, Multi-points, E-commerce)
- [ ] Créer FeaturesGridSection.tsx avec grille de 6-8 fonctionnalités principales
- [ ] Créer PaymentSection.tsx avec fond vert foncé, contenu CinetPay et image (placeholder)
- [ ] Créer AllFeaturesSection.tsx avec liste complète des fonctionnalités (fond beige clair)
- [ ] Créer GettingStartedSection.tsx avec 3 étapes numérotées (1, 2, 3)
- [ ] Créer ResourcesSection.tsx avec 3 cartes de ressources avec images (placeholders)
- [ ] Créer FAQSection.tsx avec accordéon interactif (fond sombre) et toutes les questions du landing.md
- [ ] Créer FinalCTASection.tsx avec CTA finale (fond vert) et message d'engagement
- [ ] Créer LandingFooter.tsx avec navigation complète, liens, copyright et sélecteur de langue
- [ ] Créer Landing.tsx qui assemble toutes les sections dans le bon ordre
- [ ] Modifier App.tsx pour ajouter la route '/' vers Landing et garder '/auth/login' pour accès direct
- [ ] Tester la landing page sur mobile, tablet et desktop, vérifier le header sticky et les animations
- [ ] Optimiser les images (lazy loading), vérifier le code splitting et les animations