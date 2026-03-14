// gerar-convite-profissional.js

async function gerarConviteProfissional() {
    const email = prompt("Digite o email do profissional:");
    if (!email) return;

    try {
        const supabase = window.getSupabase();
        const user = await supabase.auth.getUser();
        const tenantId = user.data.user.id;

        // Token válido por 7 dias
        const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
        const dadosConvite = {
            tenant_id: tenantId,
            email: email,
            expiry: expiry
        };

        const token = btoa(JSON.stringify(dadosConvite));
        const linkConvite = `${window.location.origin}/cadastro-profissional.html?convite=${token}`;

        // Salvar no banco para histórico
        const { error } = await supabase
            .from('convites_profissionais')
            .insert({
                tenant_id: tenantId,
                email: email,
                token: token,
                expiry: expiry
            });

        if (error) throw error;

        // Copiar link para clipboard
        navigator.clipboard.writeText(linkConvite);

        alert(`Link copiado para a área de transferência!\n\nEnvie este link para ${email}:\n\n${linkConvite}`);

    } catch (err) {
        console.error("Erro ao gerar convite:", err);
        alert("Erro ao gerar convite: " + err.message);
    }
}
