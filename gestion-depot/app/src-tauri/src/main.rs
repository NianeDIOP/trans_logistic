// Pas de console en version publiée sous Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gestion_depot_app_lib::lancer();
}
