import React, { useEffect, useRef, useState } from 'react';
import { ImageWithSkeleton } from '../common/ImageWithSkeleton';
import { ArrowRight } from 'lucide-react';

interface ResourceCardProps {
  title: string;
  classname: string;
  description: string;
  image: string;
  linkText?: string;
  delay?: number;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  classname,
  description,
  image,
  linkText = 'En savoir plus',
  delay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay * 1000);
        }
      },
      { threshold: 0.1, rootMargin: '-50px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={` rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${classname} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } `}
    >
      <div className={`aspect-[4/3] relative ${classname}`}>
        <ImageWithSkeleton
          src={image}
          alt={title}
          className={"w-full h-full object-cover"}
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-300 mb-2">{title}</h3>
        <p className={"text-gray-400 mb-4"}>{description}</p>
        <a
          href="#"
          className="text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-2 group"
        >
          {linkText}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
};
