#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

# Chemins des fichiers
script_dir = Path(__file__).parent
input_file = script_dir.parent / 'CM.txt'
output_file = script_dir.parent / 'CM.json'

print('Lecture du fichier CM.txt...')

def clean_value(value: str) -> Any:
    """Nettoie et convertit les valeurs"""
    if not value or value.strip() == '':
        return None
    value = value.strip()
    
    # Essayer de convertir en nombre si possible
    try:
        if '.' in value:
            return float(value)
        return int(value)
    except ValueError:
        return value

def parse_alternatives(alternatives_str: str) -> List[str]:
    """Parse la chaîne d'alternatives en liste"""
    if not alternatives_str or alternatives_str.strip() == '':
        return []
    
    return [alt.strip() for alt in alternatives_str.split(',') if alt.strip()]

def get_feature_type_label(feature_type: str) -> str:
    """Retourne le label du type de caractéristique"""
    labels = {
        'P': 'Populated place',
        'H': 'Hydrographic',
        'T': 'Topographic',
        'S': 'Spot',
        'L': 'Area'
    }
    return labels.get(feature_type.strip(), None)

def get_feature_code_label(feature_code: str) -> str:
    """Retourne le label du code de caractéristique"""
    labels = {
        'PPL': 'Populated Place',
        'PPLA': 'Seat of a first-order administrative division',
        'PPLA2': 'Seat of a second-order administrative division',
        'PPLA3': 'Seat of a third-order administrative division',
        'PPLA4': 'Seat of a fourth-order administrative division',
        'PPLC': 'Capital of a political entity',
        'STM': 'Stream',
        'STMI': 'Intermittent Stream',
        'HLL': 'Hill',
        'MT': 'Mountain',
        'LK': 'Lake',
        'RESV': 'Reservoir',
        'ISL': 'Island',
    }
    return labels.get(feature_code.strip(), None)

def create_location_object(columns: List[str]) -> Dict[str, Any]:
    """Crée un objet location structuré à partir des colonnes"""
    
    # Structure du fichier original (19 colonnes):
    # 0: id
    # 1: name_primary
    # 2: name_alternate
    # 3: name_alternatives
    # 4: latitude
    # 5: longitude
    # 6: feature_type
    # 7: feature_code
    # 8: country_code
    # 9: (vide)
    # 10: admin_code_1
    # 11: (vide)
    # 12: (vide)
    # 13: (vide)
    # 14: population
    # 15: (vide)
    # 16: elevation
    # 17: timezone
    # 18: modification_date
    
    if len(columns) < 19:
        # Compléter avec des valeurs vides si nécessaire
        columns.extend([''] * (19 - len(columns)))
    
    # Coordonnées
    coordinates = None
    lat = clean_value(columns[4])
    lng = clean_value(columns[5])
    if lat is not None and lng is not None:
        coordinates = {
            'latitude': lat,
            'longitude': lng
        }
    
    # Noms
    name_primary = columns[1].strip() if len(columns) > 1 else ''
    name_alternate = clean_value(columns[2]) if len(columns) > 2 else None
    name_alternatives = parse_alternatives(columns[3]) if len(columns) > 3 else []
    
    all_names = [name_primary]
    if name_alternate:
        all_names.append(name_alternate)
    all_names.extend(name_alternatives)
    all_names = list(set([n for n in all_names if n]))
    
    names = {
        'primary': name_primary,
        'alternate': name_alternate,
        'alternatives': name_alternatives,
        'all': all_names
    }
    
    # Type géographique
    feature_type = columns[6].strip() if len(columns) > 6 else ''
    feature_code = columns[7].strip() if len(columns) > 7 else ''
    
    feature = {
        'type': feature_type or None,
        'code': feature_code or None,
        'type_label': get_feature_type_label(feature_type),
        'code_label': get_feature_code_label(feature_code)
    }
    
    # Codes administratifs
    admin_codes = {}
    if len(columns) > 10 and columns[10].strip():
        admin_codes['level_1'] = columns[10].strip()
    
    # Population
    population = clean_value(columns[14]) if len(columns) > 14 else None
    if population is not None and population == 0:
        population = None
    
    # Élévation
    elevation = clean_value(columns[16]) if len(columns) > 16 else None
    
    # Timezone
    timezone = columns[17].strip() if len(columns) > 17 and columns[17].strip() else None
    
    # Date de modification
    modification_date = columns[18].strip() if len(columns) > 18 and columns[18].strip() else None
    
    # Structure finale
    location = {
        'id': columns[0].strip() if len(columns) > 0 else '',
        'names': names,
        'coordinates': coordinates,
        'feature': feature,
        'country': {
            'code': columns[8].strip() if len(columns) > 8 else None
        },
        'administrative': admin_codes if admin_codes else None,
        'elevation': {
            'meters': elevation
        } if elevation is not None else None,
        'population': population,
        'timezone': timezone,
        'metadata': {
            'modification_date': modification_date
        } if modification_date else {}
    }
    
    # Nettoyer les valeurs None
    return clean_none_values(location)

def clean_none_values(obj: Any) -> Any:
    """Supprime récursivement les valeurs None des dictionnaires"""
    if isinstance(obj, dict):
        cleaned = {}
        for key, value in obj.items():
            cleaned_value = clean_none_values(value)
            if cleaned_value is not None:
                cleaned[key] = cleaned_value
        return cleaned if cleaned else None
    elif isinstance(obj, list):
        cleaned = [clean_none_values(item) for item in obj if clean_none_values(item) is not None]
        return cleaned if cleaned else None
    else:
        return obj

# Lire et convertir
locations = []
processed = 0
errors = 0

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            try:
                line = line.rstrip('\n\r')
                if not line.strip():
                    continue
                
                # Séparer par tabulations
                columns = line.split('\t')
                
                location = create_location_object(columns)
                if location and location.get('id'):
                    locations.append(location)
                processed += 1
                
                if line_num % 1000 == 0:
                    print(f'Traité: {line_num} lignes...')
                    
            except Exception as e:
                errors += 1
                print(f'Erreur à la ligne {line_num}: {e}')
    
    # Créer la structure finale
    result = {
        'metadata': {
            'source': 'GeoNames and geographic databases',
            'country': 'Cameroon',
            'country_code': 'CM',
            'total_locations': len(locations),
            'generated_at': datetime.now().isoformat()
        },
        'locations': locations
    }
    
    # Écrire le fichier JSON
    print('\nÉcriture du fichier JSON...')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # Obtenir la taille du fichier
    file_size = os.path.getsize(output_file) / (1024 * 1024)
    
    print('\n✅ Conversion terminée!')
    print(f'- Lignes traitées: {processed}')
    print(f'- Erreurs: {errors}')
    print(f'- Lieux convertis: {len(locations)}')
    print(f'- Fichier créé: {output_file}')
    print(f'- Taille: {file_size:.2f} MB')
    
    # Statistiques supplémentaires
    feature_types = {}
    feature_codes = {}
    cities_count = 0
    with_elevation = 0
    with_population = 0
    
    for loc in locations:
        ft = loc.get('feature', {}).get('type')
        fc = loc.get('feature', {}).get('code')
        if ft:
            feature_types[ft] = feature_types.get(ft, 0) + 1
        if fc:
            feature_codes[fc] = feature_codes.get(fc, 0) + 1
        if fc == 'PPL':
            cities_count += 1
        if loc.get('elevation'):
            with_elevation += 1
        if loc.get('population'):
            with_population += 1
    
    print('\n📊 Statistiques:')
    print(f'- Villes et villages (PPL): {cities_count}')
    print(f'- Lieux avec élévation: {with_elevation}')
    print(f'- Lieux avec population: {with_population}')
    print(f'- Types de caractéristiques: {len(feature_types)}')
    for ft, count in sorted(feature_types.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f'  • {ft}: {count}')
    print(f'- Codes de caractéristiques: {len(feature_codes)}')
    for fc, count in sorted(feature_codes.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f'  • {fc}: {count}')
    
except Exception as e:
    print(f'\n❌ Erreur lors de la conversion: {e}')
    import traceback
    traceback.print_exc()
    exit(1)



