#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'analyse du fichier CM.json pour vérifier la complétude des données
"""

import json
from pathlib import Path
from collections import Counter, defaultdict
from typing import Dict, List, Any

# Mapping des codes administratifs du Cameroun
CAMEROON_REGIONS = {
    "00": "Non spécifié",
    "01": "Adamaoua",
    "02": "Centre",
    "03": "Est",
    "04": "Extrême-Nord",
    "05": "Littoral",
    "06": "Nord",
    "07": "Nord-Ouest",
    "08": "Ouest",
    "09": "Sud",
    "10": "Sud-Ouest",
    "11": "Est (alternatif)",
    "12": "Nord (alternatif)",
    "13": "Nord-Ouest (alternatif)",
    "14": "Centre (alternatif)"
}

# Feature codes pour villes et quartiers
POPULATED_PLACES = ["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC", "PPLF", "PPLG", "PPLH", "PPLL", "PPLQ", "PPLR", "PPLS", "PPLW", "PPLX"]
CITIES = ["PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC"]  # Capitales et grandes villes
NEIGHBORHOODS = ["PPLX", "PPLQ"]  # Quartiers et subdivisions

def analyze_cm_file(file_path: Path) -> Dict[str, Any]:
    """Analyse complète du fichier CM.json"""
    
    print(f"📊 Analyse du fichier: {file_path}")
    print("=" * 80)
    
    # Charger le fichier JSON
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    locations = data.get('locations', [])
    metadata = data.get('metadata', {})
    
    print(f"\n✅ Métadonnées:")
    print(f"   - Total déclaré: {metadata.get('total_locations', 0)}")
    print(f"   - Total réel: {len(locations)}")
    print(f"   - Source: {metadata.get('source', 'N/A')}")
    print(f"   - Généré le: {metadata.get('generated_at', 'N/A')}")
    
    # Statistiques par région
    print(f"\n📍 Distribution par région:")
    region_stats = Counter()
    region_by_type = defaultdict(lambda: defaultdict(int))
    
    for loc in locations:
        admin = loc.get('administrative', {})
        region_code = admin.get('level_1', '00')
        region_name = CAMEROON_REGIONS.get(region_code, f"Code inconnu: {region_code}")
        region_stats[region_code] += 1
        
        feature_code = loc.get('feature', {}).get('code', '')
        region_by_type[region_code][feature_code] += 1
    
    for code, count in sorted(region_stats.items()):
        region_name = CAMEROON_REGIONS.get(code, f"Code inconnu: {code}")
        print(f"   - {region_name} ({code}): {count:,} lieux")
    
    # Statistiques par type de lieu
    print(f"\n🏘️  Distribution par type de lieu:")
    feature_stats = Counter()
    feature_type_stats = Counter()
    
    for loc in locations:
        feature = loc.get('feature', {})
        feature_type = feature.get('type', '')
        feature_code = feature.get('code', '')
        feature_stats[feature_code] += 1
        feature_type_stats[feature_type] += 1
    
    print(f"\n   Par type géographique:")
    for ftype, count in sorted(feature_type_stats.items()):
        type_label = {
            'P': 'Lieux habités',
            'H': 'Hydrographie',
            'T': 'Topographie',
            'A': 'Zones administratives',
            'S': 'Zones de peuplement',
            'L': 'Zones de végétation',
            'V': 'Zones de végétation',
            'R': 'Routes',
            'U': 'Zones urbaines'
        }.get(ftype, f"Type {ftype}")
        print(f"      - {type_label} ({ftype}): {count:,}")
    
    print(f"\n   Par code de caractéristique (Top 20):")
    for code, count in feature_stats.most_common(20):
        code_label = {
            'PPL': 'Lieu habité',
            'PPLA': 'Capitale de région',
            'PPLA2': 'Capitale de département',
            'PPLA3': 'Capitale d\'arrondissement',
            'PPLA4': 'Capitale de localité',
            'PPLC': 'Capitale de pays',
            'PPLX': 'Quartier/Subdivision',
            'PPLQ': 'Quartier',
            'STM': 'Cours d\'eau',
            'STMI': 'Cours d\'eau intermittent',
            'HLL': 'Colline',
            'MT': 'Montagne'
        }.get(code, code)
        print(f"      - {code_label} ({code}): {count:,}")
    
    # Analyse des villes et quartiers
    print(f"\n🏙️  Analyse des villes et quartiers:")
    cities = [loc for loc in locations if loc.get('feature', {}).get('code', '') in CITIES]
    neighborhoods = [loc for loc in locations if loc.get('feature', {}).get('code', '') in NEIGHBORHOODS]
    all_populated = [loc for loc in locations if loc.get('feature', {}).get('code', '') in POPULATED_PLACES]
    
    print(f"   - Villes principales (PPLA, PPLA2, etc.): {len(cities):,}")
    print(f"   - Quartiers (PPLX, PPLQ): {len(neighborhoods):,}")
    print(f"   - Tous les lieux habités: {len(all_populated):,}")
    
    # Vérification de la complétude
    print(f"\n✅ Vérification de la complétude:")
    
    # Vérifier les 10 régions principales
    main_regions = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]
    missing_regions = []
    for code in main_regions:
        if code not in region_stats:
            missing_regions.append(CAMEROON_REGIONS[code])
    
    if missing_regions:
        print(f"   ⚠️  Régions manquantes: {', '.join(missing_regions)}")
    else:
        print(f"   ✅ Toutes les 10 régions principales sont présentes")
    
    # Vérifier les données essentielles
    locations_with_coords = sum(1 for loc in locations if loc.get('coordinates', {}).get('latitude') and loc.get('coordinates', {}).get('longitude'))
    locations_with_names = sum(1 for loc in locations if loc.get('names', {}).get('primary'))
    locations_with_region = sum(1 for loc in locations if loc.get('administrative', {}).get('level_1'))
    
    print(f"   - Lieux avec coordonnées: {locations_with_coords:,} / {len(locations):,} ({locations_with_coords/len(locations)*100:.1f}%)")
    print(f"   - Lieux avec nom: {locations_with_names:,} / {len(locations):,} ({locations_with_names/len(locations)*100:.1f}%)")
    print(f"   - Lieux avec région: {locations_with_region:,} / {len(locations):,} ({locations_with_region/len(locations)*100:.1f}%)")
    
    # Statistiques par région pour les villes
    print(f"\n🏙️  Villes par région:")
    cities_by_region = defaultdict(int)
    for city in cities:
        region_code = city.get('administrative', {}).get('level_1', '00')
        cities_by_region[region_code] += 1
    
    for code in sorted(cities_by_region.keys()):
        region_name = CAMEROON_REGIONS.get(code, f"Code inconnu: {code}")
        print(f"   - {region_name} ({code}): {cities_by_region[code]} villes")
    
    # Quartiers par région
    print(f"\n🏘️  Quartiers par région:")
    neighborhoods_by_region = defaultdict(int)
    for neighborhood in neighborhoods:
        region_code = neighborhood.get('administrative', {}).get('level_1', '00')
        neighborhoods_by_region[region_code] += 1
    
    for code in sorted(neighborhoods_by_region.keys()):
        region_name = CAMEROON_REGIONS.get(code, f"Code inconnu: {code}")
        print(f"   - {region_name} ({code}): {neighborhoods_by_region[code]} quartiers")
    
    # Résumé final
    print(f"\n" + "=" * 80)
    print(f"📊 RÉSUMÉ FINAL:")
    print(f"   ✅ Total de lieux: {len(locations):,}")
    print(f"   ✅ Villes principales: {len(cities):,}")
    print(f"   ✅ Quartiers: {len(neighborhoods):,}")
    print(f"   ✅ Lieux habités: {len(all_populated):,}")
    print(f"   ✅ Régions couvertes: {len(region_stats)}")
    
    # Recommandation
    print(f"\n💡 RECOMMANDATION:")
    if len(locations) >= 24000 and len(cities) > 0 and len(neighborhoods) > 0:
        print(f"   ✅ Le scraping peut être considéré comme TERMINÉ")
        print(f"   ✅ Les données sont complètes et utilisables")
        print(f"   ✅ Structure JSON appropriée pour intégration dans le projet")
    else:
        print(f"   ⚠️  Le scraping nécessite des compléments")
        if len(cities) == 0:
            print(f"      - Aucune ville principale trouvée")
        if len(neighborhoods) == 0:
            print(f"      - Aucun quartier trouvé")
    
    return {
        'total_locations': len(locations),
        'cities': len(cities),
        'neighborhoods': len(neighborhoods),
        'populated_places': len(all_populated),
        'regions': len(region_stats),
        'is_complete': len(locations) >= 24000 and len(cities) > 0
    }

if __name__ == '__main__':
    script_dir = Path(__file__).parent
    cm_file = script_dir.parent / 'CM.json'
    
    if not cm_file.exists():
        print(f"❌ Fichier non trouvé: {cm_file}")
        exit(1)
    
    try:
        results = analyze_cm_file(cm_file)
        exit(0)
    except Exception as e:
        print(f"❌ Erreur lors de l'analyse: {e}")
        import traceback
        traceback.print_exc()
        exit(1)


