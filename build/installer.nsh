; Personnalisation de l'installateur et du désinstallateur NSIS (electron-builder).
; Ce fichier est inclus avant le modèle d'electron-builder : les !define ci-dessous
; s'appliquent donc aux pages Modern UI qu'il insère. Encodage : UTF-8 avec BOM.

!define CONCEPTEUR "Niane Diop · 77 158 89 03"

; Couleurs des textes d'en-tête et des pages d'accueil / de fin (bleu marine de la charte).
!define MUI_TEXTCOLOR 0B2569
!define MUI_BGCOLOR FFFFFF
!define MUI_HEADER_TRANSPARENT_TEXT

; Demander confirmation si l'utilisateur interrompt l'opération.
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

!ifndef BUILD_UNINSTALLER
  ; --- Installateur ---------------------------------------------------------
  !define MUI_WELCOMEPAGE_TITLE "Bienvenue dans l'installation de 2M Facturation"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Cet assistant va installer 2M Facturation ${VERSION}, l'application de facturation du transport de conteneurs de 2M Logistique et Transport.$\r$\n$\r$\n\
L'application fonctionne entièrement hors connexion : factures, clients, tarifs et sauvegardes restent sur cet ordinateur.$\r$\n$\r$\n\
Si une version précédente est installée, vos données sont conservées.$\r$\n$\r$\n\
Cliquez sur Suivant pour continuer.$\r$\n$\r$\n$\r$\n\
Conçu par ${CONCEPTEUR}"

  !define MUI_DIRECTORYPAGE_TEXT_TOP "2M Facturation sera installé dans le dossier ci-dessous. Pour choisir un autre emplacement, cliquez sur Parcourir."

  !define MUI_FINISHPAGE_TITLE "2M Facturation est installé"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "L'installation s'est terminée avec succès.$\r$\n$\r$\n\
Un raccourci « 2M Facturation » a été ajouté sur le Bureau et dans le menu Démarrer.$\r$\n$\r$\n\
Conseil : pensez à faire régulièrement une sauvegarde (Paramètres → Sauvegarde).$\r$\n$\r$\n\
Conçu par ${CONCEPTEUR}"
  !define MUI_FINISHPAGE_RUN_TEXT "Lancer 2M Facturation maintenant"

  !macro customWelcomePage
    !insertmacro MUI_PAGE_WELCOME
  !macroend
!else
  ; --- Désinstallateur ------------------------------------------------------
  !define MUI_WELCOMEPAGE_TITLE "Désinstallation de 2M Facturation"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Cet assistant va retirer 2M Facturation de cet ordinateur.$\r$\n$\r$\n\
Vos factures, vos paramètres et vos sauvegardes ne sont pas supprimés : ils restent dans votre dossier utilisateur et seront retrouvés si vous réinstallez l'application.$\r$\n$\r$\n\
Avant de continuer, fermez 2M Facturation.$\r$\n$\r$\n\
Cliquez sur Suivant pour continuer.$\r$\n$\r$\n$\r$\n\
Conçu par ${CONCEPTEUR}"

  !define MUI_FINISHPAGE_TITLE "2M Facturation a été désinstallé"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "L'application a été retirée de cet ordinateur.$\r$\n$\r$\n\
Vos données sont conservées. Pour les transférer sur un autre poste, utilisez l'export JSON ou une sauvegarde (Paramètres → Sauvegarde).$\r$\n$\r$\n\
Merci d'avoir utilisé 2M Facturation.$\r$\n$\r$\n\
Conçu par ${CONCEPTEUR}"
!endif

!macro customHeader
  BrandingText "2M Facturation ${VERSION} — Conçu par ${CONCEPTEUR}"
!macroend
