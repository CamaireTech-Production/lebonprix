#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import os
from pathlib import Path

# Chemins des fichiers
script_dir = Path(__file__).parent
input_file = script_dir.parent / 'CM.txt'
output_file = script_dir.parent / 'CM.csv'

print('Lecture du fichier CM.txt...')

# En-têtes CSV - correspondant aux 19 colonnes du fichier original
headers = [
    'id',
    'name_primary',
    'name_alternate',
    'name_alternatives',
    'latitude',
    'longitude',
    'feature_type',
    'feature_code',
    'country_code',
    'admin_code_1',
    'admin_code_2',
    'admin_code_3',
    'admin_code_4',
    'population',
    'elevation',
    'timezone',
    'modification_date'
]

processed = 0
errors = 0

try:
    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        
        writer = csv.writer(outfile)
        
        # Écrire les en-têtes
        writer.writerow(headers)
        
        # Lire et traiter chaque ligne
        for line_num, line in enumerate(infile, 1):
            try:
                line = line.rstrip('\n\r')
                if not line.strip():
                    continue
                
                # Séparer par tabulations
                columns = line.split('\t')
                
                # Le fichier original a 19 colonnes, mais certaines peuvent être vides
                # On prend les colonnes pertinentes (17 colonnes nommées)
                # Mapping: 0-8, 10, 14, 16, 17, 18
                if len(columns) >= 19:
                    # Structure: id, name_primary, name_alternate, name_alternatives, lat, lon, 
                    # feature_type, feature_code, country, (vide), admin_code_1, (vide), (vide), (vide),
                    # population, (vide), elevation, timezone, modification_date
                    row = [
                        columns[0],   # id
                        columns[1],   # name_primary
                        columns[2],   # name_alternate
                        columns[3],   # name_alternatives
                        columns[4],   # latitude
                        columns[5],   # longitude
                        columns[6],   # feature_type
                        columns[7],   # feature_code
                        columns[8],   # country_code
                        columns[10] if len(columns) > 10 else '',  # admin_code_1
                        '',           # admin_code_2
                        '',           # admin_code_3
                        '',           # admin_code_4
                        columns[14] if len(columns) > 14 else '',  # population
                        columns[16] if len(columns) > 16 else '',   # elevation
                        columns[17] if len(columns) > 17 else '',   # timezone
                        columns[18] if len(columns) > 18 else ''    # modification_date
                    ]
                else:
                    # Fallback: prendre les colonnes disponibles
                    while len(columns) < 17:
                        columns.append('')
                    row = columns[:17]
                writer.writerow(row)
                
                processed += 1
                
                if line_num % 1000 == 0:
                    print(f'Traité: {line_num} lignes...')
                    
            except Exception as e:
                errors += 1
                print(f'Erreur à la ligne {line_num}: {e}')
    
    # Obtenir la taille du fichier
    file_size = os.path.getsize(output_file) / (1024 * 1024)
    
    print('\n✅ Conversion terminée!')
    print(f'- Lignes traitées: {processed}')
    print(f'- Erreurs: {errors}')
    print(f'- Fichier créé: {output_file}')
    print(f'- Taille: {file_size:.2f} MB')
    
except Exception as e:
    print(f'\n❌ Erreur lors de la conversion: {e}')
    exit(1)

