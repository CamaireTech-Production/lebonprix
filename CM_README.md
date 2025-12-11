# Fichier de données géographiques du Cameroun (CM)

## Description

Ce fichier contient une base de données géographique complète des lieux (villes, villages, points d'eau, montagnes, etc.) du Cameroun.

## Fichiers disponibles

- **CM.txt** : Fichier original au format tabulé (TSV)
- **CM.csv** : Fichier formaté au format CSV avec en-têtes lisibles
- **CM.json** : Fichier formaté au format JSON avec structure détaillée et typée

## Structure des données

Le fichier CSV contient les colonnes suivantes :

| Colonne | Description | Exemple |
|---------|-------------|---------|
| `id` | Identifiant unique du lieu | 2220645 |
| `name_primary` | Nom principal du lieu | Emini-Pabela |
| `name_alternate` | Nom alternatif principal | Emini-Pabela |
| `name_alternatives` | Autres noms alternatifs (séparés par virgules) | Emini-Pabela,Pabela |
| `latitude` | Latitude en degrés décimaux | 4.9 |
| `longitude` | Longitude en degrés décimaux | 12.95 |
| `feature_type` | Type de caractéristique géographique | P (Populated place), H (Hydrographic), T (Topographic) |
| `feature_code` | Code de caractéristique détaillé | PPL (Populated Place), STM (Stream), HLL (Hill), MT (Mountain) |
| `country_code` | Code pays ISO | CM (Cameroun) |
| `admin_code_1` | Code administratif niveau 1 (région) | 11, 04, 12, etc. |
| `admin_code_2` | Code administratif niveau 2 | (vide dans la plupart des cas) |
| `admin_code_3` | Code administratif niveau 3 | (vide dans la plupart des cas) |
| `admin_code_4` | Code administratif niveau 4 | (vide dans la plupart des cas) |
| `population` | Population (si disponible) | 0 (non disponible dans la plupart des cas) |
| `elevation` | Élévation en mètres | 684 |
| `timezone` | Fuseau horaire | Africa/Douala |
| `modification_date` | Date de dernière modification | 2012-01-16 |

## Types de caractéristiques (feature_type)

- **P** : Populated place (Lieu habité - ville, village)
- **H** : Hydrographic (Hydrographie - rivière, cours d'eau)
- **T** : Topographic (Topographie - montagne, colline)

## Codes de caractéristiques (feature_code)

- **PPL** : Populated Place (Lieu habité)
- **STM** : Stream (Cours d'eau)
- **STMI** : Intermittent Stream (Cours d'eau intermittent)
- **HLL** : Hill (Colline)
- **MT** : Mountain (Montagne)

## Statistiques

- **Nombre total de lieux** : 24,061
- **Villes et villages (PPL)** : 14,317
- **Cours d'eau (STM/STMI)** : 7,454
- **Montagnes et collines (MT/HLL)** : 1,115
- **Taille du fichier CSV** : ~1.70 MB
- **Taille du fichier JSON** : ~16.40 MB
- **Format** : CSV (UTF-8) / JSON (UTF-8)
- **Séparateur CSV** : Virgule (,)
- **Encodage** : UTF-8

## Structure JSON

Le fichier JSON suit une structure hiérarchique claire :

```json
{
  "metadata": {
    "source": "GeoNames and geographic databases",
    "country": "Cameroon",
    "country_code": "CM",
    "total_locations": 24061,
    "generated_at": "2025-12-10T16:52:22.990350"
  },
  "locations": [
    {
      "id": "2220645",
      "names": {
        "primary": "Emini-Pabela",
        "alternate": "Emini-Pabela",
        "alternatives": ["Emini-Pabela", "Pabela"],
        "all": ["Emini-Pabela", "Pabela"]
      },
      "coordinates": {
        "latitude": 4.9,
        "longitude": 12.95
      },
      "feature": {
        "type": "P",
        "code": "PPL",
        "type_label": "Populated place",
        "code_label": "Populated Place"
      },
      "country": {
        "code": "CM"
      },
      "administrative": {
        "level_1": "11"
      },
      "elevation": {
        "meters": 684
      },
      "timezone": "Africa/Douala",
      "metadata": {
        "modification_date": "2012-01-16"
      }
    }
  ]
}
```

### Champs de chaque location

- **id** : Identifiant unique
- **names** : Objet contenant tous les noms (primary, alternate, alternatives, all)
- **coordinates** : Objet avec latitude et longitude (nombres)
- **feature** : Type et code géographique avec labels explicites
- **country** : Code pays
- **administrative** : Codes administratifs par niveau (level_1, level_2, etc.)
- **elevation** : Élévation en mètres (objet avec champ "meters")
- **population** : Population (nombre, si disponible)
- **timezone** : Fuseau horaire
- **metadata** : Métadonnées (date de modification, etc.)

## Utilisation

### Lecture du JSON avec JavaScript/TypeScript

```typescript
import cameroonLocations from './CM.json';

// Accéder aux métadonnées
console.log(`Total: ${cameroonLocations.metadata.total_locations} lieux`);

// Parcourir les lieux
cameroonLocations.locations.forEach(location => {
  console.log(`${location.names.primary}: ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
});

// Rechercher une ville
const douala = cameroonLocations.locations.find(
  loc => loc.names.all.some(name => 
    name.toLowerCase().includes('douala')
  )
);
```

### Lecture avec Python

```python
import csv

with open('CM.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(f"{row['name_primary']}: {row['latitude']}, {row['longitude']}")
```

### Lecture du JSON avec Python

```python
import json

with open('CM.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    
print(f"Total: {data['metadata']['total_locations']} lieux")

# Rechercher une ville
for location in data['locations']:
    if 'douala' in location['names']['primary'].lower():
        print(f"{location['names']['primary']}: {location['coordinates']}")
```

### Filtrage par type

Pour obtenir uniquement les villes et villages (lieux habités) :

```python
import csv

cities = []
with open('CM.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row['feature_code'] == 'PPL':
            cities.append(row)
```

### Recherche par nom

```python
import csv

def search_by_name(name):
    results = []
    with open('CM.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if name.lower() in row['name_primary'].lower():
                results.append(row)
    return results

# Rechercher "Douala"
douala_locations = search_by_name('Douala')
```

## Notes

- Les données sont basées sur GeoNames et d'autres sources géographiques
- Les dates de modification indiquent la dernière mise à jour de chaque enregistrement
- Certains champs peuvent être vides selon les données disponibles
- Le fuseau horaire est uniformément "Africa/Douala" pour tout le Cameroun

## Scripts de conversion

Les fichiers ont été générés à partir du fichier TSV original :

- **CSV** : `scripts/formatCM.py`
- **JSON** : `scripts/convertCMToJSONDirect.py`

Pour régénérer les fichiers :

```bash
# Générer le CSV
python3 scripts/formatCM.py

# Générer le JSON (recommandé - structure plus complète)
python3 scripts/convertCMToJSONDirect.py
```

## Utilisation dans l'application TypeScript

Des types TypeScript sont disponibles dans `src/types/cameroon-locations.ts` avec des utilitaires pour :

- Recherche par nom (exacte ou partielle)
- Filtrage par type géographique
- Calcul de distance entre deux points
- Extraction des coordonnées
- Obtention de tous les noms alternatifs

Voir le fichier pour plus de détails.

