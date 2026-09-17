-- Corrige el nombre del negocio: era "Aramru", el correcto es "Amaru".

update "SP_founder"
set role = 'CEO & Fundador · Amaru'
where role = 'CEO & Fundador · Aramru';
