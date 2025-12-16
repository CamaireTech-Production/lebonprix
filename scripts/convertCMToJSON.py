#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import json
import os
from pathlib import Path
from typing import Dict, Any

# Chemins des fichiers
script_dir = Path(__file__).parent
input_file = script_dir.parent / 'CM.csv'
output_file = script_dir.parent / 'CM.json'

print('Lecture du fichier CM.csv...')

def clean_value(value: str) -> Any:
    """Nettoie et convertit les valeurs"""
    if not value or value.strip() == '':
        return None
    
    # Essayer de convertir en nombre si possible
    try:
        # Vérifier si c'est un nombre décimal
        if '.' in value:
            return float(value)
        # Vérifier si c'est un entier
        return int(value)
    except ValueError:
        # Retourner la chaîne telle quelle
        return value.strip()

def parse_alternatives(alternatives_str: str) -> list:
    """Parse la chaîne d'alternatives en liste"""
    if not alternatives_str or alternatives_str.strip() == '':
        return []
    
    return [alt.strip() for alt in alternatives_str.split(',') if alt.strip()]

def create_location_object(row: Dict[str, str]) -> Dict[str, Any]:
    """Crée un objet location structuré à partir d'une ligne CSV"""
    
    # Coordonnées
    coordinates = None
    lat = clean_value(row.get('latitude', ''))
    lng = clean_value(row.get('longitude', ''))
    if lat is not None and lng is not None:
        coordinates = {
            'latitude': lat,
            'longitude': lng
        }
    
    # Noms
    names = {
        'primary': row.get('name_primary', '').strip(),
        'alternate': clean_value(row.get('name_alternate', '')),
        'alternatives': parse_alternatives(row.get('name_alternatives', ''))
    }
    
    # Tous les noms combinés
    all_names = [names['primary']]
    if names['alternate']:
        all_names.append(names['alternate'])
    all_names.extend(names['alternatives'])
    names['all'] = list(set([n for n in all_names if n]))
    
    # Type géographique
    feature = {
        'type': row.get('feature_type', '').strip() or None,
        'code': row.get('feature_code', '').strip() or None,
        'type_label': get_feature_type_label(row.get('feature_type', '')),
        'code_label': get_feature_code_label(row.get('feature_code', ''))
    }
    
    # Codes administratifs
    admin_codes = {}
    for i in range(1, 5):
        code = row.get(f'admin_code_{i}', '').strip()
        if code:
            admin_codes[f'level_{i}'] = code
    
    # Élévation - vérifier si c'est un nombre valide
    elevation_str = row.get('elevation', '').strip()
    elevation = None
    if elevation_str:
        try:
            elevation = float(elevation_str)
            if elevation == 0:
                # Si elevation est 0, vérifier si modification_date contient l'élévation
                mod_date = row.get('modification_date', '').strip()
                if mod_date and mod_date.isdigit():
                    elevation = float(mod_date)
        except ValueError:
            pass
    
    # Population
    population_str = row.get('population', '').strip()
    population = None
    if population_str:
        try:
            pop = int(population_str)
            population = pop if pop > 0 else None
        except ValueError:
            pass
    
    # Timezone
    timezone = row.get('timezone', '').strip() or None
    
    # Date de modification - peut être dans elevation ou modification_date
    modification_date = row.get('modification_date', '').strip()
    # Si modification_date ressemble à un nombre (c'est probablement l'élévation)
    if modification_date and modification_date.isdigit():
        # L'élévation était dans modification_date, chercher la vraie date ailleurs
        modification_date = None
    elif not modification_date or modification_date == '':
        modification_date = None
    
    # Structure finale
    location = {
        'id': row.get('id', '').strip(),
        'names': names,
        'coordinates': coordinates,
        'feature': feature,
        'country': {
            'code': row.get('country_code', '').strip() or None
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

def get_feature_type_label(feature_type: str) -> str:
    """Retourne le label du type de caractéristique"""
    labels = {
        'P': 'Populated place',
        'H': 'Hydrographic',
        'T': 'Topographic'
    }
    return labels.get(feature_type.strip(), None)

def get_feature_code_label(feature_code: str) -> str:
    """Retourne le label du code de caractéristique"""
    labels = {
        'PPL': 'Populated Place',
        'STM': 'Stream',
        'STMI': 'Intermittent Stream',
        'HLL': 'Hill',
        'MT': 'Mountain',
        'LK': 'Lake',
        'RESV': 'Reservoir',
        'ISL': 'Island',
        'PPLA': 'Seat of a first-order administrative division',
        'PPLA2': 'Seat of a second-order administrative division',
        'PPLA3': 'Seat of a third-order administrative division',
        'PPLA4': 'Seat of a fourth-order administrative division',
        'PPLC': 'Capital of a political entity',
    }
    return labels.get(feature_code.strip(), None)

# Lire et convertir
locations = []
processed = 0
errors = 0

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for line_num, row in enumerate(reader, 1):
            try:
                location = create_location_object(row)
                if location:
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
            'generated_at': None  # Sera rempli par le script
        },
        'locations': locations
    }
    
    # Ajouter la date de génération
    from datetime import datetime
    result['metadata']['generated_at'] = datetime.now().isoformat()
    
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
    for loc in locations:
        ft = loc.get('feature', {}).get('type')
        fc = loc.get('feature', {}).get('code')
        if ft:
            feature_types[ft] = feature_types.get(ft, 0) + 1
        if fc:
            feature_codes[fc] = feature_codes.get(fc, 0) + 1
    
    print('\n📊 Statistiques:')
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

