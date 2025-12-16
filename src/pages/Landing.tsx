import React from 'react';
import { LandingHeader } from '../components/landing/LandingHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { PartnersLogosSection } from '../components/landing/PartnersLogosSection';
import { WhyGeskapSection } from '../components/landing/WhyGeskapSection';
import { UseCasesSection } from '../components/landing/UseCasesSection';
import { EverythingYouNeedSection } from '../components/landing/EverythingYouNeedSection';
import { FeaturesGridSection } from '../components/landing/FeaturesGridSection';
import { PaymentSection } from '../components/landing/PaymentSection';
import { POSSoftwareCarouselSection } from '../components/landing/POSSoftwareCarouselSection';
import { POSHardwareSection } from '../components/landing/POSHardwareSection';
import { AllFeaturesSection } from '../components/landing/AllFeaturesSection';
import { GettingStartedSection } from '../components/landing/GettingStartedSection';
import { ResourcesSection } from '../components/landing/ResourcesSection';
import { FAQSection } from '../components/landing/FAQSection';
import { FinalCTASection } from '../components/landing/FinalCTASection';
import { LandingFooter } from '../components/landing/LandingFooter';
import Pricing from '../components/landing/Pricing';

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen">
      <LandingHeader />
      <main>
        <HeroSection />
        <PartnersLogosSection />
        <UseCasesSection />
        <EverythingYouNeedSection />
        <WhyGeskapSection />
        <FeaturesGridSection />
        <PaymentSection />
        <POSSoftwareCarouselSection />
        <POSHardwareSection />
        <AllFeaturesSection />
        <GettingStartedSection />
        <Pricing />
        <ResourcesSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Landing;

