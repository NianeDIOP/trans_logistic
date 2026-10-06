import { BrowserWindow } from 'electron'
import type { TypeImage } from '../shared/parametres'
import { getDatabase } from './db'
import * as P from './db/parametres'
import { choisirEtCopierImage, imageEnDataUrl, supprimerImage } from './images'
import { canal } from './ipc-commun'
import { documentFacture } from './pdf/generer'
import { factureExemple } from './pdf/exemple'
import { lireFacture } from './db/factures'

function verifierTypeImage(type: TypeImage): TypeImage {
  if (type !== 'logo' && type !== 'cachet') throw new Error("Type d'image inconnu")
  return type
}

export function registerParametresHandlers(): void {
  const db = getDatabase

  // Entreprise
  canal('parametres:entreprise:lire', () => P.lireEntreprise(db()))
  canal('parametres:entreprise:modifier', (_e, saisie) => P.modifierEntreprise(db(), saisie))
  canal('parametres:entreprise:lireImage', (_e, type: TypeImage) => {
    const e = P.lireEntreprise(db())
    return imageEnDataUrl(verifierTypeImage(type) === 'logo' ? e.logo_path : e.cachet_path)
  })
  canal('parametres:entreprise:choisirImage', async (event, type: TypeImage) => {
    verifierTypeImage(type)
    const chemin = await choisirEtCopierImage(BrowserWindow.fromWebContents(event.sender), type)
    if (!chemin) return null
    const e = P.lireEntreprise(db())
    const ancien = type === 'logo' ? e.logo_path : e.cachet_path
    P.definirImage(db(), type, chemin)
    await supprimerImage(ancien)
    return imageEnDataUrl(chemin)
  })
  canal('parametres:entreprise:retirerImage', async (_e, type: TypeImage) => {
    const e = P.lireEntreprise(db())
    const ancien = verifierTypeImage(type) === 'logo' ? e.logo_path : e.cachet_path
    P.definirImage(db(), type, null)
    await supprimerImage(ancien)
  })

  canal('parametres:entreprise:definirPresentation', (_e, modele: string, theme: string) =>
    P.definirPresentation(db(), modele, theme)
  )
  canal('parametres:entreprise:apercuModele', async (_e, modele: string, theme: string) => {
    // Aperçu sur la dernière facture émise, sinon sur une facture d'exemple.
    const e = P.lireEntreprise(db())
    const derniere = db()
      .prepare("SELECT id FROM factures WHERE type = 'facture' AND statut <> 'brouillon' ORDER BY date DESC, id DESC LIMIT 1")
      .get() as { id: number } | undefined
    const facture = derniere ? lireFacture(db(), derniere.id) : factureExemple(e.taux_tva)
    return (await documentFacture(facture, e, 'ecran', { modele, theme })).html
  })

  // Clients
  canal('parametres:clients:lister', (_e, options) => P.listerClients(db(), options))
  canal('parametres:clients:creer', (_e, saisie) => P.creerClient(db(), saisie))
  canal('parametres:clients:modifier', (_e, id, saisie) => P.modifierClient(db(), id, saisie))
  canal('parametres:clients:supprimer', (_e, id) => P.supprimerClient(db(), id))
  canal('parametres:clients:reactiver', (_e, id) => P.reactiverClient(db(), id))

  // Zones et tarifs
  canal('parametres:zones:lister', (_e, inclure) => P.listerZones(db(), inclure))
  canal('parametres:zones:enregistrer', (_e, ancien, saisie) => P.enregistrerZone(db(), ancien, saisie))
  canal('parametres:zones:supprimer', (_e, nom) => P.supprimerZone(db(), nom))
  canal('parametres:zones:reactiver', (_e, nom) => P.reactiverZone(db(), nom))

  // Prestations
  canal('parametres:prestations:lister', (_e, inclure) => P.listerPrestations(db(), inclure))
  canal('parametres:prestations:creer', (_e, saisie) => P.creerPrestation(db(), saisie))
  canal('parametres:prestations:modifier', (_e, id, saisie) => P.modifierPrestation(db(), id, saisie))
  canal('parametres:prestations:supprimer', (_e, id) => P.supprimerPrestation(db(), id))
  canal('parametres:prestations:reactiver', (_e, id) => P.reactiverPrestation(db(), id))

  // Listes
  canal('parametres:listes:lister', (_e, nom, inclure) => P.listerListe(db(), nom, inclure))
  canal('parametres:listes:ajouter', (_e, nom, libelle) => P.ajouterElement(db(), nom, libelle))
  canal('parametres:listes:renommer', (_e, nom, id, libelle) => P.renommerElement(db(), nom, id, libelle))
  canal('parametres:listes:supprimer', (_e, nom, id) => P.supprimerElement(db(), nom, id))
  canal('parametres:listes:reactiver', (_e, nom, id) => P.reactiverElement(db(), nom, id))
}
