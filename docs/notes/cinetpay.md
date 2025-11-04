CinetPay SDK-SEAMLESS integration
Contexte
Les étapes
1) Importation du sdk seamless
2) Création du formulaire
3) Initialisation
4) Envoi données
5) Callback
6) Fermeture du seamless
7) Préparation pages de notification
Aperçu
Exemple d'intégration
Erreurs fréquentes

Contexte
Aujourd’hui, CinetPay met à disposition de ses marchands un guichet de paiement fonctionnant par appel API. Cependant, pour élargir son pôle d’intégration marchand, elle donne la possibilité d’une intégration spéciale relativement à chaque langage de programmation. En effet, le SDK Seamless est l’un de ses outils propre au Javascript, facilitant l’intégration du guichet.

Ainsi, le marchand pourra utiliser celui-ci dans du code Javascript, lui permettant de faire appel au guichet de CinetPay.
La suite du document, montrera les différentes étapes d’utilisation du SDK Seamless dans un projet.


LES ETAPES
L'intégration du seamless se fait en 5 étapes:

seamless

1) IMPORTATION DU SDK SEAMLESS
Avant de commencer, il faut lier le seamless SDK à votre page. Cela se fait dans la balise head de votre page web :

<head>

    <script src="https://cdn.cinetpay.com/seamless/main.js" type="text/javascript"></script>

</head>
Copy

2) CREATION DU FORMULAIRE
Le formulaire de paiement CinetPay est constitué des éléments disponibles dans la section API DE PAIEMENT. Cliquer pour accéder.


3) INITIALISATION DES PARAMETRES
En vue d’invoquer le guichet, certains éléments sont nécessaires à la reconnaissance du marchand :

apikey : L’identifiant du marchand
site_id: L'identifiant du service
close_after_response: Permet de fermer le guichet automatiquement (Facultatif - true ou false)
type: WEB ou MOBILE (Facultatif - Par défaut WEB)
notify_url: URL de notification de paiement valide
 CinetPay.setConfig({
    apikey: 'YOUR_API_KEY',
    site_id: YOUR_SITE_ID,
    notify_url: 'https://mondomaine.com/notify/',
    close_after_response: true,
});
Copy

4) ENVOI DES DONNEES
Pour que le guichet puisse se charger et s’afficher chez l’acheteur, il suffit de passer au SDK les données du paiement. En effet, sur une action de l’acheteur, vous fournirez les données du formulaire :

CinetPay.getCheckout({
    transaction_id: 'YOUR_TRANSACTION_ID',
    amount: 100,
    currency: 'XOF',
    channels: 'ALL',
    description: 'YOUR_PAYMENT_DESCRIPTION',
    //Fournir ces variables obligatoirement pour le paiements par carte bancaire
    customer_name:"Joe",//Le nom du client
    customer_surname:"Down",//Le prenom du client
    customer_email: "down@test.com",//l'email du client
    customer_phone_number: "088767611",//l'email du client
    customer_address : "BP 0024",//addresse du client
    customer_city: "Antananarivo",// La ville du client
    customer_country : "CM",// le code ISO du pays
    customer_state : "CM",// le code ISO l'état
    customer_zip_code : "06510", // code postal
});
Copy

5) CONFIGURATION DU RETOUR APRES PAIEMENT(CALLBACK)
Après chaque paiement, le seamless vous permet d'observer l'état de la transaction à l'aide de la methode CinetPay.waitResponse(function(data){})

Le paramètre data contient les données retournées au marchand dans l’intégration après chaque paiement :

amount : Montant payé,
currency: Devise,
status : État de la transaction "ACCEPTED" ou "REFUSED"
payment_method : Moyen de paiement
description : Description fournie à l'initialisation
metadata: Metadata fournie à l'initialisation,
operator_id : Identifiant de l'opérateur,
payment_date : Date de paiement
{
      "amount": "100", 
      "currency": "XOF", 
      "status": "ACCEPTED", 
      "payment_method": "FLOOZ", 
      "description": "Description", 
      "metadata": "ABIDJAN", 
      "operator_id": "8211027064102", 
     "payment_date": "2021-10-27 09:47:09"
}
Copy
Utilisez le callback du seamless pour effectuer vos différents traitements (redirection, mise à jour, etc...) :

   CinetPay.waitResponse(function(data) {
         // En cas d'échec
          if (data.status == "REFUSED") {
              if (alert("Votre paiement a échoué")) {
                  window.location.reload();
              }
          }
          // En cas de succès
          else if (data.status == "ACCEPTED") {
              if (alert("Votre paiement a été effectué avec succès")) {
                  // correct, on delivre le service
                  window.location.reload();
              }
          }
   });
Copy

6) CONFIGURATION APRES FERMETURE AUTOMATIQUE
Par défaut , le popup du seamless contient un bouton de fermeture situé en haut à droite comme illustré sur l'image👇

seamless


Attention :En définissant le paramètre close_after_response à true, le guichet sera fermé automatiquement après paiement. L'utilisateur n'aura pas la possibilité d'effectuer d'autre action sur le guichet( Telecharger le reçu ou contacter le support).

Si vous optez pour une fermeture automatique du guichet, assurez-vous de bien gérer le retour après fermeture à l'aide de la fonction: CinetPay.onClose(function(data){})

Exemple:

    // À l'écoute de la fermeture du guichet
    CinetPay.onClose(function(data) {
        if (data.status === "REFUSED") {
            // Afficher un message de paiement échec à l'utilisateur (Facultatif)
            alert("Votre paiement a échoué");
        } else if (data.status === "ACCEPTED") {
            // Afficher un message de paiement succès à l'utilisateur (Facultatif)
            alert("Votre paiement a été effectué avec succès");
        } else {
            // Afficher un message de fermeture du guichet (Facultatif)
            alert('Fermeture du guichet');
        }

        // Rafraichir la page après fermeture du guichet 
        // (Permet de recharger le Seamless pour un éventuel nouveau paiement)
        window.location.reload();
    });
Copy

7) PREPARATION DES PAGES DE NOTIFICATION
Pourquoi utilisez une url de notification?

Même si vous avez configuré correctement le callback seamless, n'oubliez pas que l'url de notification est le seul mécanisme habilité pour synchroniser automatiquement les paiements vers votre site marchand. CinetPay appellera ce lien après chaque update pour vous notifier du changement de statuts pendant le déroulement d'une transaction.

Vous pouvez configurer votre url de notification, suivant le modèle du sdk php


<?php 

if (isset($_POST['cpm_trans_id'])) {

    try {

        require_once __DIR__ . '/../src/new-guichet.php';
        require_once __DIR__ . '/../commande.php';
        require_once __DIR__ . '/../marchand.php';

        //Création d'un fichier log pour s'assurer que les éléments sont bien exécuté
        $log  = "User: ".$_SERVER['REMOTE_ADDR'].' - '.date("F j, Y, g:i a").PHP_EOL.
        "TransId:".$_POST['cpm_trans_id'].PHP_EOL.
        "SiteId: ".$_POST['cpm_site_id'].PHP_EOL.
        "-------------------------".PHP_EOL;
        //Save string to log, use FILE_APPEND to append.
        file_put_contents('./log_'.date("j.n.Y").'.log', $log, FILE_APPEND);

        //La classe commande correspond à votre colonne qui gère les transactions dans votre base de données
        $commande = new Commande();
        // Initialisation de CinetPay et Identification du paiement
        $id_transaction = $_POST['cpm_trans_id'];
        // apiKey
        $apikey = $marchand["apikey"];

        // siteId
        $site_id = $_POST['cpm_site_id'];

        $CinetPay = new CinetPay($site_id, $apikey);
        //On recupère le statut de la transaction dans la base de donnée
        /* $commande->set_transactionId($id_transaction);
             //Il faut s'assurer que la transaction existe dans notre base de donnée
         * $commande->getCommandeByTransId();
         */

        // On verifie que la commande n'a pas encore été traité
        $VerifyStatusCmd = "1"; // valeur du statut à recupérer dans votre base de donnée
        if ($VerifyStatusCmd == '00') {
            // La commande a été déjà traité
            // Arret du script
            die();
        }

        // Dans le cas contrait, on verifie l'état de la transaction en cas de tentative de paiement sur CinetPay

        $CinetPay->getPayStatus($id_transaction, $site_id);

        $amount = $CinetPay->chk_amount;
        $currency = $CinetPay->chk_currency;
        $message = $CinetPay->chk_message;
        $code = $CinetPay->chk_code;
        $metadata = $CinetPay->chk_metadata;

        //Something to write to txt log
        $log  = "User: ".$_SERVER['REMOTE_ADDR'].' - '.date("F j, Y, g:i a").PHP_EOL.
            "Code:".$code.PHP_EOL.
            "Message: ".$message.PHP_EOL.
            "Amount: ".$amount.PHP_EOL.
            "currency: ".$currency.PHP_EOL.
            "-------------------------".PHP_EOL;
        //Save string to log, use FILE_APPEND to append.
        file_put_contents('./log_'.date("j.n.Y").'.log', $log, FILE_APPEND);

        // On verifie que le montant payé chez CinetPay correspond à notre montant en base de données pour cette transaction
        if ($code == '00') {
            // correct, on delivre le service
            echo 'Felicitation, votre paiement a été effectué avec succès';
            die();

        } else {
            // transaction n'est pas valide
            echo 'Echec, votre paiement a échoué pour cause : ' .$message;
            die();
        }
        // mise à jour des transactions dans la base de donnée
        /*  $commande->update(); */

    } catch (Exception $e) {
        echo "Erreur :" . $e->getMessage();
    }
} else {
    // direct acces on IPN
    echo "cpm_trans_id non fourni";
}
Copy
Apple a déployé une mise à jour sur Safari incluant la fonctionnalité "Prevent Cross-Site Tracking", qui entraîne la suppression des cookies dans les pop-ups. Avec l'intégration seamless, le clic sur le bouton "Payer" peut rediriger l'utilisateur vers le site de CinetPay sur iOS.



APERCU DU SEAMLESS
seamless



EXEMPLE D'INTEGRATION
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.cinetpay.com/seamless/main.js"></script>
    <style>
        .sdk {
            display: block;
            position: absolute;
            background-position: center;
            text-align: center;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
        }
    </style>
    <script>
        function checkout() {
            CinetPay.setConfig({
                apikey: '',//   YOUR APIKEY
                site_id: '',//YOUR_SITE_ID
                notify_url: 'http://mondomaine.com/notify/',
                mode: 'PRODUCTION'
            });
            CinetPay.getCheckout({
                transaction_id: Math.floor(Math.random() * 100000000).toString(),
                amount: 100,
                currency: 'XOF',
                channels: 'ALL',
                description: 'Test de paiement',   
                 //Fournir ces variables pour le paiements par carte bancaire
                customer_name:"Joe",//Le nom du client
                customer_surname:"Down",//Le prenom du client
                customer_email: "down@test.com",//l'email du client
                customer_phone_number: "088767611",//l'email du client
                customer_address : "BP 0024",//addresse du client
                customer_city: "Antananarivo",// La ville du client
                customer_country : "CM",// le code ISO du pays
                customer_state : "CM",// le code ISO l'état
                customer_zip_code : "06510", // code postal

            });
            CinetPay.waitResponse(function(data) {
                if (data.status == "REFUSED") {
                    if (alert("Votre paiement a échoué")) {
                        window.location.reload();
                    }
                } else if (data.status == "ACCEPTED") {
                    if (alert("Votre paiement a été effectué avec succès")) {
                        window.location.reload();
                    }
                }
            });
            CinetPay.onError(function(data) {
                console.log(data);
            });
        }
    </script>
</head>
<body>
    </head>
    <body>
        <div class="sdk">
            <h1>SDK SEAMLESS</h1>
            <button onclick="checkout()">Checkout</button>
        </div>
    </body>
</html>  
Copy

Erreurs Fréquentes
Code	Cause	Solution
Code: 403	Restriction cloudflare dûe au réseau ou une erreur dans la requête	1) Change network
2) The metadata value is in Json and this format is not supported; you can format the values in base64 for better interpretation
Le guichet charge indéfiniment	Il y a une erreur dans la requête	Vous trouverez dans la console, la cause de l'erreur
La soumission du bouton "payer" redirige vers le site de CinetPay	Les difficultés rencontrées sont dues à des mesures de sécurité de Apple;
une mise a jour a été initialisée dans laquelle le système “ Prevent cross-site tracking” sur les navigateurs Safari détruit les cookies contenus dans les popup.	Pour régler cela , il suffit de décocher l'option Prevent cross-site tracking sur le navigateur.
Dans l'immédiat, la solution est d'intégrer notre api de paiement par redirection, en suivant cette documentation


A la découverte des univers de paiement
Le nouveau guichet de paiement offre la possibilité au marchand d'autoriser un paiement uniquement que via un des univers supporté par CinetPay: MOBILE MONEY, CREDIT CARD, WALLET

A la découverte des univers de paiement
MOBILE MONEY
CREDIT CARD
WALLET

MOBILE MONEY
Le mobile money est un moyen de paiement qui permet aux individus de recevoir, conserver et dépenser de l’argent en utilisant leur téléphone portable. Avec le mobile money, le numéro de téléphone correspond au numéro de compte !

La plupart du temps, le mobile money est proposé par votre opérateur téléphonique, quel que soit votre forfait (prépayé ou paiement mensuel).

Pour afficher uniquement l'univers MOBILE MONEY sur le guichet , vous devez définir la variable channel à MOBILE_MONEY pendant l'initialisation

univers_mobile
1. INDICATIF DU PAYS:
L'affichage des pays est fonction de la devise; A l'initialisation si vous definissez le XOF comme devise, alors ce sont les pays qui utilisent qui ont pour devise le XOF qui seront disponible dans la liste.

univers_mobile
Le guichet détecte et affiche le pays correspondant à la position du payeur

NB: Si le numéro saisi ne correspond pas à un opérateur, vous ne pourrez pas continuer le paiement

2. OPERATEURS DISPONIBLES
Cette zone présente la liste des opérateurs disponibles pour le pays selectionné (non cliquable)

3. NUMERO DE TELEPHONE
Saisissez le numéro de téléphone, le guichet détecte automatiquement et affiche le logo de l'opérateur dans le cercle à l'extrémité.


Comment effectuer une réclamation?
Si l'utilisateur a été debité après un paiement échec, il doit adresser un mail au support.marchands@cinetpay.com en fournissant ces informations:

L'identifiant de la transaction
le numéro Mobile Money
le montant
la date et l'heure approximative du paiement.

CREDIT CARD
Le guichet de paiement permet de payer aussi par carte bancaire.

Pour afficher uniquement l'univers CREDIT CARD sur le guichet , vous devez :

définir la variable channel à CREDIT_CARD pendant l'initialisation
fournir certaines informations concernant le client(nom, prenom, numéro de téléphone, email, addresse , ville, pays, code postal) pour plus details , veuillez lire la section sur l'initialisation
univers_credit_card
Sur l'univers Credit_Card, Il peut arriver que client soit redirigé vers le formulaire de la banque après avoir cliquer sur le bouton PAYER où il pourra continuer son paiement(3DSecure disponible).


Comment effectuer une réclamation?
Si l'utilisateur a été debité après un paiement échec, il doit adresser un mail au support.marchands@cinetpay.com en fournissant ces informations:

6 premier et 4 derniers chiffres de la carte
le montant
le nom associé à la carte
la date et l'heure approximative du paiement.
BON A SAVOIR
Le paiement par carte bancaire n'est pas encore disponible pour les devises suivantes :

GNF (Guinée)
CDF (RDCongo CDF)

WALLET
Un wallet est un portefeuille électronique, il est semblable au MOBILE MONEY sauf que le numéro ne correspond pas obligatoirement au compte



Pour afficher uniquement l'univers WALLET sur le guichet , vous devez définir la variable channel à WALLET pendant l'initialisation

univers_wallet
CHOIX DU WALLET:
l'utilisateur sélectionne son wallet puis clique sur payer.